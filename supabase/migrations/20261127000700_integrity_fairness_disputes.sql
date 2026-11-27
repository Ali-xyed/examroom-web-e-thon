-- All RPC changes are installed atomically by the migration runner.
alter table examroom.exams add column blueprint jsonb not null default '[]';
alter table examroom.questions add column ambiguous boolean not null default false;
alter table examroom.attempts add column paper_ready boolean not null default false;
alter table examroom.attempts add column last_seen timestamptz;
alter table examroom.attempts add column connection_id uuid;
alter table examroom.incidents drop constraint incidents_event_check;
alter table examroom.incidents add constraint incidents_event_check check(event in ('page_hidden','focus_lost','paste','fullscreen_exit','connection_lost'));
alter table examroom.incidents add column client_id uuid;
alter table examroom.incidents add column client_at timestamptz;
create unique index incidents_idempotency on examroom.incidents(attempt_id,client_id) where client_id is not null;

create table examroom.attempt_questions (
 attempt_id uuid not null references examroom.attempts,
 question_id uuid not null references examroom.questions,
 position integer not null,
 primary key(attempt_id,question_id), unique(attempt_id,position)
);
-- Existing attempts retain their complete original paper.
insert into examroom.attempt_questions select a.id,q.id,q.position from examroom.attempts a join examroom.questions q on q.exam_id=a.exam_id;
update examroom.attempts set paper_ready=true;
create table examroom.answer_timing (
 attempt_id uuid not null references examroom.attempts, question_id uuid not null references examroom.questions,
 first_saved_at timestamptz not null default clock_timestamp(), last_saved_at timestamptz not null default clock_timestamp(),
 active_ms bigint not null default 0 check(active_ms between 0 and 172800000),
 revisions integer not null default 1,
 primary key(attempt_id,question_id)
);
create table examroom.disconnects (
 id uuid primary key default gen_random_uuid(), attempt_id uuid not null references examroom.attempts,
 started_at timestamptz not null, restored_at timestamptz, source text not null check(source in ('heartbeat_timeout','client_report')),
 client_id uuid, unique(attempt_id,started_at), unique(attempt_id,client_id)
);
create table examroom.disputes (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references examroom.exams,
 attempt_id uuid not null references examroom.attempts, question_id uuid not null references examroom.questions,
 kind text not null check(kind in ('question','grade')),
 reason text not null check(length(trim(reason)) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 resolution text, decision_reason text, created_at timestamptz not null default clock_timestamp(),
 resolved_at timestamptz, resolved_by uuid references examroom.profiles
);
create unique index disputes_one_pending on examroom.disputes(attempt_id,question_id,kind) where status='pending';
create index disputes_queue on examroom.disputes(exam_id,status,created_at);
create table examroom.grade_overrides (
 attempt_id uuid not null references examroom.attempts, question_id uuid not null references examroom.questions,
 grade numeric not null check(grade>=0), primary key(attempt_id,question_id)
);
create table examroom.audit_log (
 id bigint generated always as identity primary key, exam_id uuid not null references examroom.exams,
 actor_id uuid references examroom.profiles, action text not null,
 entity_id text not null, before_data jsonb, after_data jsonb,
 created_at timestamptz not null default clock_timestamp()
);
create index audit_exam on examroom.audit_log(exam_id,id);
create function examroom.record_disconnects(eid uuid default null) returns void language sql security definer set search_path='' as $$
 insert into examroom.disconnects(attempt_id,started_at,source)
 select id,coalesce(last_seen,started_at)+interval '45 seconds','heartbeat_timeout' from examroom.attempts at
 where (eid is null or at.exam_id=eid) and (at.submitted_at is null or at.submitted_at=at.deadline)
 and coalesce(at.last_seen,at.started_at)+interval '45 seconds'<least(clock_timestamp(),at.deadline)
 on conflict do nothing
$$;
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
 perform cron.schedule('uncooked-disconnect-log','* * * * *','select examroom.record_disconnects()');
 end if;
end $$;
create function examroom.prevent_audit_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Audit entries are append-only.'; end $$;
create trigger audit_immutable before update or delete or truncate on examroom.audit_log for each statement execute function examroom.prevent_audit_mutation();
create function examroom.audit_changes() returns trigger language plpgsql security definer set search_path='' as $$
declare eid uuid; before_row jsonb; after_row jsonb;
begin
 if tg_op<>'INSERT' then before_row:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then after_row:=to_jsonb(new); end if;
 if tg_table_name='disputes' then eid:=coalesce(new.exam_id,old.exam_id);
 elsif tg_table_name='questions' then eid:=coalesce(new.exam_id,old.exam_id);
 else select exam_id into eid from examroom.attempts where id=coalesce(new.attempt_id,old.attempt_id); end if;
 insert into examroom.audit_log(exam_id,actor_id,action,entity_id,before_data,after_data)
 values(eid,auth.uid(),tg_table_name||'.'||lower(tg_op),coalesce(coalesce(after_row,before_row)->>'id',(coalesce(after_row,before_row)->>'attempt_id')||'/'||(coalesce(after_row,before_row)->>'question_id')),before_row,after_row);
 return coalesce(new,old);
end $$;
-- Responses include every written-grade change; answer text is omitted from audit snapshots.
create function examroom.audit_grade() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='INSERT' and new.grade is not null) or (tg_op='UPDATE' and new.grade is distinct from old.grade) then
 insert into examroom.audit_log(exam_id,actor_id,action,entity_id,before_data,after_data)
 select a.exam_id,auth.uid(),'grade.changed',new.attempt_id::text||'/'||new.question_id::text,
 case when tg_op='UPDATE' then jsonb_build_object('grade',old.grade) else null end,jsonb_build_object('grade',new.grade)
 from examroom.attempts a where a.id=new.attempt_id;
 end if; return new;
end $$;
create trigger audit_dispute after insert or update on examroom.disputes for each row execute function examroom.audit_changes();
create trigger audit_override after insert or update on examroom.grade_overrides for each row execute function examroom.audit_changes();
create trigger audit_question after update of ambiguous on examroom.questions for each row when(old.ambiguous is distinct from new.ambiguous) execute function examroom.audit_changes();
create trigger audit_written_grade after insert or update of grade on examroom.responses for each row execute function examroom.audit_grade();

create table public.examroom_live_events (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null, owner_id uuid not null,
 candidate_name text not null, event text not null, created_at timestamptz not null default clock_timestamp()
);
create index live_events_exam on public.examroom_live_events(exam_id,created_at);
alter table public.examroom_live_events enable row level security;
revoke all on public.examroom_live_events from public,anon,authenticated;
grant select on public.examroom_live_events to authenticated;
create function public.examroom_can_monitor(eid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from examroom.exams e join examroom.profiles p on p.id=e.owner_id
 where e.id=eid and p.id=auth.uid() and p.active and p.role='examiner')
$$;
revoke all on function public.examroom_can_monitor(uuid) from public,anon;
grant execute on function public.examroom_can_monitor(uuid) to authenticated;
create policy live_owner on public.examroom_live_events for select to authenticated using(owner_id=(select auth.uid()) and public.examroom_can_monitor(exam_id));
create function examroom.incident_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.examroom_live_events(exam_id,owner_id,candidate_name,event)
 select a.exam_id,e.owner_id,p.name,new.event from examroom.attempts a join examroom.exams e on e.id=a.exam_id
 join examroom.profiles p on p.id=a.candidate_id where a.id=new.attempt_id;
 return new;
end $$;
create trigger incident_live after insert on examroom.incidents for each row execute function examroom.incident_notification();
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 execute 'alter publication supabase_realtime add table public.examroom_live_events';
 end if;
end $$;

create table examroom.datesheet_mail (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references examroom.exams,
 candidate_id uuid not null references examroom.profiles, schedule_key text not null,
 state text not null default 'pending' check(state in ('pending','sending','sent','failed')),
 claim_id uuid, claimed_at timestamptz, sent_at timestamptz, error text,
 unique(exam_id,candidate_id,schedule_key)
);
do $$ declare t text; begin
 foreach t in array array['attempt_questions','answer_timing','disconnects','disputes','grade_overrides','audit_log','datesheet_mail'] loop
 execute format('alter table examroom.%I enable row level security',t);
 execute format('revoke all on examroom.%I from public,anon,authenticated',t);
 end loop;
end $$;
revoke all on all functions in schema examroom from public,anon,authenticated;

create or replace function examroom.scores(eid uuid) returns jsonb language sql security invoker set search_path='' as $$
select coalesce(jsonb_agg(row_data),'[]') from (
 select a.id,p.name,a.candidate_id,a.submitted_at,sum(q.marks) total,
 sum(case when q.ambiguous then q.marks when ov.grade is not null then ov.grade
 when q.kind='written' then coalesce(r.grade,0)
 when q.kind='multiple' then case when (select coalesce(array_agg(x order by x),'{}'::integer[]) from unnest(r.selected) x)=(select array_agg(x order by x) from unnest(q.correct_set) x) then q.marks else 0 end
 else case when ans.choice=q.correct then q.marks else 0 end end) score,
 count(*) filter(where q.kind='written' and r.grade is null and ov.grade is null and not q.ambiguous) pending
 from examroom.attempts a join examroom.profiles p on p.id=a.candidate_id
 join examroom.attempt_questions aq on aq.attempt_id=a.id join examroom.questions q on q.id=aq.question_id
 left join examroom.answers ans on ans.attempt_id=a.id and ans.question_id=q.id
 left join examroom.responses r on r.attempt_id=a.id and r.question_id=q.id
 left join examroom.grade_overrides ov on ov.attempt_id=a.id and ov.question_id=q.id
 where a.exam_id=eid and a.submitted_at is not null group by a.id,p.name
) row_data
$$;

alter function public.examroom_request(text,jsonb) rename to examroom_v5;
revoke all on function public.examroom_v5(text,jsonb) from public,anon,authenticated;
create function public.examroom_request(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 p examroom.profiles; e examroom.exams; a examroom.attempts; q examroom.questions; d examroom.disputes;
 eid uuid; qid uuid; result jsonb; item jsonb; buckets jsonb; qty integer; eligible integer; pos integer:=0;
 arr uuid[]; cid uuid; old_scores jsonb; new_scores jsonb; grade_value numeric; selected_ids uuid[]; schedule text;
begin
 select * into p from examroom.profiles where id=auth.uid();
 if p.id is null or not p.active then raise exception 'Account unavailable.'; end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Provide an object containing the request fields.'; end if;
 eid:=nullif(payload->>'examId','')::uuid;
 if eid is not null then
   if operation in ('paper_settings','publish','dispute_resolve','mail_claim') then select * into e from examroom.exams where id=eid for update;
   else select * into e from examroom.exams where id=eid; end if;
 end if;
 if operation='create' then
   result:=public.examroom_v5(operation,payload);
   for item in select value||jsonb_build_object('position',ordinality) from jsonb_array_elements(payload->'questions') with ordinality loop
     if coalesce(item->>'difficulty','medium') not in ('easy','medium','hard') then raise exception 'Choose easy, medium, or hard difficulty.'; end if;
     update examroom.questions set difficulty=coalesce(item->>'difficulty','medium') where exam_id=(result->>'id')::uuid and position=(item->>'position')::integer;
   end loop; return result;
 end if;
 if operation='paper_settings' then
   if p.role<>'examiner' or e.owner_id is distinct from p.id then raise exception 'Exam unavailable.'; end if;
   perform 1 from examroom.exams where id=eid for update;
   if e.published then raise exception 'Published paper settings are locked.'; end if;
   buckets:=payload->'buckets';
   if jsonb_typeof(buckets) is distinct from 'array' or jsonb_array_length(buckets)>30 then raise exception 'Provide at most 30 difficulty and mark buckets.'; end if;
   if exists(select 1 from jsonb_array_elements(buckets) b group by b->>'difficulty',b->>'marks' having count(*)>1) then raise exception 'Each difficulty and mark combination must be unique.'; end if;
   for item in select value from jsonb_array_elements(buckets) loop
     if coalesce(item->>'difficulty','') not in ('easy','medium','hard') or coalesce(item->>'count','')!~'^[1-9][0-9]?$' or coalesce(item->>'marks','')!~'^[1-9][0-9]{0,2}$' then raise exception 'Enter a difficulty, positive count, and marks for every bucket.'; end if;
     select count(*) into eligible from examroom.questions where exam_id=eid and difficulty=item->>'difficulty' and marks=(item->>'marks')::integer;
     if eligible<(item->>'count')::integer then raise exception 'Not enough % questions worth % marks. Available: %.',item->>'difficulty',item->>'marks',eligible; end if;
     pos:=pos+(item->>'count')::integer;
   end loop;
   if pos>50 then raise exception 'A paper may contain at most 50 questions.'; end if;
   update examroom.exams set blueprint=buckets where id=eid;
   insert into examroom.audit_log(exam_id,actor_id,action,entity_id,before_data,after_data) values(eid,p.id,'paper.settings',eid::text,e.blueprint,buckets);
   return jsonb_build_object('buckets',buckets);
 end if;
 if operation in ('start','resume') then
   result:=public.examroom_v5(operation,payload);
   select * into a from examroom.attempts where exam_id=eid and candidate_id=p.id for update;
   if not a.paper_ready then
     if jsonb_array_length(e.blueprint)=0 then
       insert into examroom.attempt_questions select a.id,z.id,row_number() over(order by case when e.randomize then md5(a.id::text||z.id::text) else lpad(z.position::text,8,'0') end) from examroom.questions z where z.exam_id=eid;
     else
       arr:='{}'::uuid[];
       for item in select value from jsonb_array_elements(e.blueprint) loop
         select array_agg(z.id) into selected_ids from (select id from examroom.questions where exam_id=eid and difficulty=item->>'difficulty' and marks=(item->>'marks')::integer order by md5(a.id::text||id::text) limit (item->>'count')::integer) z;
         if cardinality(selected_ids) is distinct from (item->>'count')::integer then raise exception 'Paper pool is incomplete. Contact your examiner.'; end if;
         arr:=arr||selected_ids;
       end loop;
       insert into examroom.attempt_questions select a.id,z.id,row_number() over(order by md5(a.id::text||z.id::text)) from unnest(arr) z(id);
     end if;
     update examroom.attempts set paper_ready=true,last_seen=clock_timestamp() where id=a.id;
   end if;
   return jsonb_set(result,'{questions}',(select coalesce(jsonb_agg(j.value||jsonb_build_object('difficulty',z.difficulty,'revision',coalesce(r.revision,0),'activeMs',coalesce(t.active_ms,0)) order by aq.position),'[]') from jsonb_array_elements(result->'questions') j join examroom.attempt_questions aq on aq.attempt_id=a.id and aq.question_id=(j.value->>'id')::uuid join examroom.questions z on z.id=aq.question_id left join examroom.responses r on r.attempt_id=a.id and r.question_id=z.id left join examroom.answer_timing t on t.attempt_id=a.id and t.question_id=z.id));
 end if;
 if operation='grade' then
   if not exists(select 1 from examroom.attempt_questions where attempt_id=(payload->>'attemptId')::uuid and question_id=(payload->>'questionId')::uuid) then raise exception 'Question is not assigned to this attempt.'; end if;
   result:=public.examroom_v5(operation,payload);
   update examroom.grade_overrides set grade=(payload->>'grade')::numeric where attempt_id=(payload->>'attemptId')::uuid and question_id=(payload->>'questionId')::uuid;
   return jsonb_set(result,'{scores}',examroom.scores(eid));
 end if;
 if operation='save' then
   select * into a from examroom.attempts where exam_id=eid and candidate_id=p.id for update;
   qid:=(payload->>'questionId')::uuid;
   if a.id is null or not exists(select 1 from examroom.attempt_questions where attempt_id=a.id and question_id=qid) then raise exception 'Question is not assigned to your paper.'; end if;
   result:=public.examroom_v5(operation,payload);
   if result->>'submittedAt' is null and not coalesce((result->>'stale')::boolean,false) then
     insert into examroom.answer_timing(attempt_id,question_id,active_ms) values(a.id,qid,least(172800000,greatest(0,coalesce((payload->>'activeMs')::bigint,0))))
     on conflict(attempt_id,question_id) do update set last_saved_at=clock_timestamp(),revisions=examroom.answer_timing.revisions+1,active_ms=greatest(examroom.answer_timing.active_ms,excluded.active_ms);
     update examroom.attempts set last_seen=clock_timestamp() where id=a.id;
   end if;
   return result;
 end if;
 if operation in ('heartbeat','incident') then
   if p.role<>'candidate' or e.id is null then raise exception 'Exam unavailable.'; end if;
   select * into a from examroom.attempts where exam_id=eid and candidate_id=p.id for update;
   if a.id is null then raise exception 'Attempt unavailable.'; end if;
   if operation='heartbeat' then
     perform examroom.record_disconnects(eid);
     if a.submitted_at is null and a.deadline<=clock_timestamp() then update examroom.attempts set submitted_at=deadline where id=a.id returning * into a; end if;
     update examroom.disconnects set restored_at=least(clock_timestamp(),a.deadline) where attempt_id=a.id and restored_at is null;
     update examroom.attempts set last_seen=clock_timestamp(),connection_id=nullif(payload->>'connectionId','')::uuid where id=a.id;
     return jsonb_build_object('deadline',a.deadline,'submittedAt',a.submitted_at,'serverTime',clock_timestamp());
   end if;
   if coalesce(payload->>'event','') not in ('page_hidden','focus_lost','paste','fullscreen_exit','connection_lost') then raise exception 'Unknown incident type.'; end if;
   if (select count(*) from examroom.incidents where attempt_id=a.id)>=2000 then return '{}'::jsonb; end if;
   cid:=(payload->>'clientId')::uuid;
   if cid is null then raise exception 'Incident ID required.'; end if;
   insert into examroom.incidents(attempt_id,event,client_id,client_at) values(a.id,payload->>'event',cid,least(clock_timestamp(),greatest(a.started_at,coalesce((payload->>'clientAt')::timestamptz,clock_timestamp())))) on conflict do nothing;
   if payload->>'event'='connection_lost' then
     insert into examroom.disconnects(attempt_id,started_at,restored_at,source,client_id) values(a.id,least(a.deadline,clock_timestamp(),greatest(a.started_at,coalesce((payload->>'clientAt')::timestamptz,clock_timestamp()))),least(a.deadline,clock_timestamp()),'client_report',cid) on conflict do nothing;
   end if;
   return '{}'::jsonb;
 end if;
 if operation in ('dispute_create','disputes','dispute_resolve','audit','paper_pool','datesheet','mail_claim','mail_complete') then
   if e.id is null then raise exception 'Exam unavailable.'; end if;
   if p.role='examiner' and e.owner_id=p.id then null;
   elsif operation in ('dispute_create','disputes') and p.role='candidate' and exists(select 1 from examroom.enrollments where exam_id=eid and candidate_id=p.id) then null;
   else raise exception 'Exam unavailable.'; end if;
   if operation='paper_pool' then
     return jsonb_build_object('buckets',e.blueprint,'published',e.published,'pool',(select coalesce(jsonb_agg(jsonb_build_object('difficulty',t.difficulty,'marks',t.marks,'available',t.available) order by t.difficulty,t.marks),'[]') from(select difficulty,marks,count(*) available from examroom.questions where exam_id=eid group by difficulty,marks)t));
   elsif operation='audit' then
     return (select coalesce(jsonb_agg(to_jsonb(t) order by t.id desc),'[]') from(select l.id,l.action,l.entity_id,l.before_data,l.after_data,l.created_at,pr.name actor from examroom.audit_log l left join examroom.profiles pr on pr.id=l.actor_id where l.exam_id=eid order by l.id desc limit 500)t);
   elsif operation='dispute_create' then
     if p.role<>'candidate' then raise exception 'Candidate access required.'; end if;
     select * into a from examroom.attempts where exam_id=eid and candidate_id=p.id;
     qid:=(payload->>'questionId')::uuid;
     if a.id is null or not exists(select 1 from examroom.attempt_questions where attempt_id=a.id and question_id=qid) then raise exception 'Question unavailable.'; end if;
     if payload->>'kind'='grade' and (not e.results_published or a.submitted_at is null) then raise exception 'Published grade required.'; end if;
     if coalesce(payload->>'kind','') not in ('question','grade') or coalesce(length(trim(payload->>'reason')),0) not between 10 and 2000 then raise exception 'Choose a dispute type and provide a reason of 10 to 2000 characters.'; end if;
     if exists(select 1 from examroom.disputes where attempt_id=a.id and question_id=qid and kind=payload->>'kind' and status='pending') then raise exception 'A dispute for this question is already pending.'; end if;
     insert into examroom.disputes(exam_id,attempt_id,question_id,kind,reason) values(eid,a.id,qid,payload->>'kind',trim(payload->>'reason'));
   elsif operation='dispute_resolve' then
     perform 1 from examroom.exams where id=eid for update;
     select * into d from examroom.disputes where id=(payload->>'disputeId')::uuid and exam_id=eid for update;
     if d.id is null or d.status<>'pending' then raise exception 'This dispute is unavailable or already resolved.'; end if;
     if coalesce(payload->>'resolution','') not in ('reject','accept','ambiguous','grade') or coalesce(length(trim(payload->>'reason')),0) not between 10 and 2000 then raise exception 'Choose a decision and provide a reason of 10 to 2000 characters.'; end if;
     select * into q from examroom.questions where id=d.question_id;
     old_scores:=examroom.scores(eid);
     if payload->>'resolution'='ambiguous' then
       update examroom.questions set ambiguous=true where id=q.id;
     elsif payload->>'resolution'='grade' then
       grade_value:=(payload->>'grade')::numeric;
       if d.kind<>'grade' or grade_value is null or grade_value<0 or grade_value>q.marks then raise exception 'Provide a grade within the question maximum.'; end if;
       insert into examroom.grade_overrides values(d.attempt_id,q.id,grade_value) on conflict(attempt_id,question_id) do update set grade=excluded.grade;
     end if;
     update examroom.disputes set status=case when payload->>'resolution'='reject' then 'rejected' else 'accepted' end,resolution=payload->>'resolution',decision_reason=trim(payload->>'reason'),resolved_at=clock_timestamp(),resolved_by=p.id where id=d.id;
     new_scores:=examroom.scores(eid);
     if old_scores is distinct from new_scores then
       insert into examroom.audit_log(exam_id,actor_id,action,entity_id,before_data,after_data) values(eid,p.id,case when payload->>'resolution'='ambiguous' then 'regrade.all_attempts' else 'regrade.attempt' end,q.id::text,old_scores,new_scores);
     end if;
   elsif operation in ('datesheet','mail_claim','mail_complete') then
     if not e.published then raise exception 'Publish the exam before sending its datesheet.'; end if;
     schedule:=md5(e.title||e.opens_at::text||e.closes_at::text||e.duration::text);
     if operation='mail_complete' then
       update examroom.datesheet_mail set state=case when coalesce((payload->>'sent')::boolean,false) then 'sent' else 'failed' end,sent_at=case when (payload->>'sent')::boolean then clock_timestamp() end,error=left(payload->>'error',500)
       where id=(payload->>'mailId')::uuid and exam_id=eid and claim_id=(payload->>'claimId')::uuid and state='sending';
       return '{}'::jsonb;
     elsif operation='mail_claim' then
       insert into examroom.datesheet_mail(exam_id,candidate_id,schedule_key)
       select eid,n.candidate_id,schedule from examroom.enrollments n join examroom.profiles pr on pr.id=n.candidate_id join auth.users u on u.id=pr.id where n.exam_id=eid and pr.active and u.email!~*'\.(example|test|invalid)$' on conflict do nothing;
       with todo as(select id from examroom.datesheet_mail where exam_id=eid and schedule_key=schedule and (state in ('pending','failed') or (state='sending' and claimed_at<clock_timestamp()-interval '10 minutes')) order by id limit 10 for update skip locked)
       update examroom.datesheet_mail m set state='sending',claim_id=gen_random_uuid(),claimed_at=clock_timestamp(),error=null from todo where m.id=todo.id;
       return jsonb_build_object('exam',to_jsonb(e)-'owner_id','jobs',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'claimId',m.claim_id,'name',pr.name,'email',u.email)),'[]') from examroom.datesheet_mail m join examroom.profiles pr on pr.id=m.candidate_id join auth.users u on u.id=pr.id where m.exam_id=eid and m.schedule_key=schedule and m.state='sending' and m.claimed_at>=statement_timestamp()));
     end if;
     return jsonb_build_object('exam',to_jsonb(e)-'owner_id','candidates',(select coalesce(jsonb_agg(jsonb_build_object('name',pr.name,'email',u.email,'deliverable',pr.active and u.email!~*'\.(example|test|invalid)$','state',coalesce(m.state,'pending')) order by pr.name),'[]') from examroom.enrollments n join examroom.profiles pr on pr.id=n.candidate_id join auth.users u on u.id=pr.id left join examroom.datesheet_mail m on m.exam_id=n.exam_id and m.candidate_id=n.candidate_id and m.schedule_key=schedule where n.exam_id=eid));
   end if;
   return jsonb_build_object('questions',(select coalesce(jsonb_agg(jsonb_build_object('id',z.id,'prompt',z.prompt,'marks',z.marks,'ambiguous',z.ambiguous) order by aq.position),'[]') from examroom.attempts at join examroom.attempt_questions aq on aq.attempt_id=at.id join examroom.questions z on z.id=aq.question_id where at.exam_id=eid and at.candidate_id=p.id),
   'disputes',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]') from(select dis.*,pr.name candidate,z.prompt,z.marks from examroom.disputes dis join examroom.attempts at on at.id=dis.attempt_id join examroom.profiles pr on pr.id=at.candidate_id join examroom.questions z on z.id=dis.question_id where dis.exam_id=eid and (p.role='examiner' or at.candidate_id=p.id))t));
 end if;
 if operation='monitor' then
   if p.role<>'examiner' or e.owner_id is distinct from p.id then raise exception 'Exam unavailable.'; end if;
   insert into examroom.disconnects(attempt_id,started_at,source)
   select id,coalesce(last_seen,started_at)+interval '45 seconds','heartbeat_timeout' from examroom.attempts at where at.exam_id=eid and at.submitted_at is null and at.deadline>clock_timestamp() and coalesce(at.last_seen,at.started_at)<clock_timestamp()-interval '45 seconds' on conflict do nothing;
   result:=public.examroom_v5(operation,payload);
   result:=jsonb_set(result,'{attempts}',(select coalesce(jsonb_agg(attempt||jsonb_build_object('written',(
      select coalesce(jsonb_agg(written),'[]') from jsonb_array_elements(attempt->'written') written
      where exists(select 1 from examroom.attempt_questions aq where aq.attempt_id=(attempt->>'id')::uuid and aq.question_id=(written->>'id')::uuid)
   ))),'[]') from jsonb_array_elements(result->'attempts') attempt));
   return result||jsonb_build_object('integrity',(select coalesce(jsonb_agg(jsonb_build_object('attemptId',at.id,'name',pr.name,'lastSeen',at.last_seen,'deadline',at.deadline,
     'disconnects',(select coalesce(jsonb_agg(to_jsonb(dc)-'attempt_id' order by dc.started_at desc),'[]') from examroom.disconnects dc where dc.attempt_id=at.id),
     'timings',(select coalesce(jsonb_agg(jsonb_build_object('questionId',t.question_id,'activeMs',t.active_ms,'firstSavedAt',t.first_saved_at,'lastSavedAt',t.last_saved_at,'revisions',t.revisions,'indicator',t.active_ms<2000) order by t.first_saved_at),'[]') from examroom.answer_timing t where t.attempt_id=at.id))) ,'[]') from examroom.attempts at join examroom.profiles pr on pr.id=at.candidate_id where at.exam_id=eid));
 end if;
 return public.examroom_v5(operation,payload);
end $$;
revoke all on function public.examroom_request(text,jsonb) from public,anon;
grant execute on function public.examroom_request(text,jsonb) to authenticated;
