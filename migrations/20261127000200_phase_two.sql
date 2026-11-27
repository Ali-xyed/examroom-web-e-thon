alter table examroom.profiles add column active boolean not null default true;
alter table examroom.exams add column results_published boolean not null default false;
alter table examroom.exams add column randomize boolean not null default false;
alter table examroom.questions add column kind text not null default 'single' check (kind in ('single','multiple','written'));
alter table examroom.questions add column correct_set integer[] not null default '{}';
alter table examroom.questions add column topic text not null default 'General';
alter table examroom.questions add column difficulty text not null default 'medium';
create table examroom.bank (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references examroom.profiles,
 prompt text not null check(length(trim(prompt)) between 1 and 2000),
 choices text[] not null check(cardinality(choices)=4),
 kind text not null check(kind in ('single','multiple','written')),
 correct integer not null check(correct between 0 and 3), correct_set integer[] not null,
 marks integer not null check(marks between 1 and 100), topic text not null,
 difficulty text not null check(difficulty in ('easy','medium','hard'))
);
create table examroom.responses (
 attempt_id uuid not null references examroom.attempts, question_id uuid not null references examroom.questions,
 selected integer[] not null default '{}', written text not null default '' check(length(written)<=20000),
 grade numeric check(grade>=0), primary key(attempt_id,question_id)
);
create table examroom.announcements (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references examroom.exams,
 message text not null check(length(trim(message)) between 1 and 2000), created_at timestamptz not null default now()
);
create table examroom.incidents (
 id uuid primary key default gen_random_uuid(), attempt_id uuid not null references examroom.attempts,
 event text not null check(event in ('page_hidden','connection_lost')), created_at timestamptz not null default now()
);
create index bank_owner on examroom.bank(owner_id);
create index announcements_exam on examroom.announcements(exam_id);
create index incidents_attempt on examroom.incidents(attempt_id);
alter table examroom.bank enable row level security;
alter table examroom.responses enable row level security;
alter table examroom.announcements enable row level security;
alter table examroom.incidents enable row level security;

alter function public.examroom_request(text,jsonb) rename to examroom_v1;
revoke all on function public.examroom_v1(text,jsonb) from public,anon,authenticated;

create function examroom.scores(eid uuid) returns jsonb language sql security invoker set search_path='' as $$
select coalesce(jsonb_agg(row_data),'[]') from (
select a.id, p.name, a.candidate_id, a.submitted_at,
  sum(q.marks) as total,
  sum(case
    when q.kind='written' then coalesce(r.grade,0)
    when q.kind='multiple' then case when
      (select coalesce(array_agg(x order by x),'{}'::integer[]) from unnest(r.selected) x)
      = (select array_agg(x order by x) from unnest(q.correct_set) x) then q.marks else 0 end
    else case when ans.choice=q.correct then q.marks else 0 end end) as score,
  count(*) filter(where q.kind='written' and r.grade is null) as pending
from examroom.attempts a join examroom.profiles p on p.id=a.candidate_id
join examroom.questions q on q.exam_id=a.exam_id
left join examroom.answers ans on ans.attempt_id=a.id and ans.question_id=q.id
left join examroom.responses r on r.attempt_id=a.id and r.question_id=q.id
where a.exam_id=eid and a.submitted_at is not null group by a.id,p.name
) row_data
$$;
revoke all on function examroom.scores(uuid) from public;

create function public.examroom_request(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 p examroom.profiles; e examroom.exams; a examroom.attempts; b examroom.bank;
 eid uuid; uid uuid; qid uuid; item jsonb; result jsonb; rows jsonb; selected integer[]; inst timestamptz;
begin
 select * into p from examroom.profiles where id=auth.uid();
 if p.id is null or not p.active then raise exception 'Account unavailable.'; end if;
 if operation like 'admin_%' then
   if p.role<>'administrator' then raise exception 'Administrator access required.'; end if;
   if operation='admin_save' then
     uid:=nullif(payload->>'id','')::uuid;
     if payload->>'role' not in ('administrator','examiner','candidate') or length(trim(payload->>'name')) not between 1 and 100 then raise exception 'Enter a name and valid role.'; end if;
     if uid is null then
       if length(payload->>'password')<12 or (payload->>'email') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Provide a valid email and password of at least 12 characters.'; end if;
       uid:=gen_random_uuid();
       insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
       values('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated',lower(trim(payload->>'email')),
       extensions.crypt(payload->>'password',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{}',now(),now());
       insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
       values(uid::text,uid,jsonb_build_object('sub',uid::text,'email',lower(trim(payload->>'email')),'email_verified',true),'email',now(),now());
       insert into examroom.profiles(id,name,role) values(uid,trim(payload->>'name'),payload->>'role');
     else
       if uid=p.id and (payload->>'role'<>'administrator' or not (payload->>'active')::boolean) then raise exception 'Keep your own administrator access active.'; end if;
       update examroom.profiles set name=trim(payload->>'name'),role=payload->>'role',active=(payload->>'active')::boolean where id=uid;
       if length(coalesce(payload->>'password',''))>0 then
         if length(payload->>'password')<12 then raise exception 'Password must contain at least 12 characters.'; end if;
         update auth.users set encrypted_password=extensions.crypt(payload->>'password',extensions.gen_salt('bf')),updated_at=now() where id=uid;
         delete from auth.sessions where user_id=uid;
       end if;
     end if;
   end if;
   return (select coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.name,'role',pr.role,'active',pr.active,'email',u.email) order by pr.name),'[]')
     from examroom.profiles pr join auth.users u on u.id=pr.id);
 end if;
 if operation in ('bank','bank_save') then
   if p.role<>'examiner' then raise exception 'Examiner access required.'; end if;
   if operation='bank_save' then
     selected:=array(select distinct value::integer from jsonb_array_elements_text(coalesce(payload->'correctSet','[]')) order by 1);
     if payload->>'kind'='multiple' and (cardinality(selected)=0 or not selected <@ array[0,1,2,3]) then raise exception 'Select one or more correct choices.'; end if;
     if exists(select 1 from jsonb_array_elements_text(payload->'choices') v where length(trim(v)) not between 1 and 500) then raise exception 'Enter all four choices.'; end if;
     uid:=nullif(payload->>'id','')::uuid;
     if uid is not null and not exists(select 1 from examroom.bank where id=uid and owner_id=p.id) then raise exception 'Question unavailable.'; end if;
     insert into examroom.bank(id,owner_id,prompt,choices,kind,correct,correct_set,marks,topic,difficulty)
       values(coalesce(uid,gen_random_uuid()),p.id,trim(payload->>'prompt'),array(select jsonb_array_elements_text(payload->'choices')),
       payload->>'kind',(payload->>'correct')::integer,selected,(payload->>'marks')::integer,left(payload->>'topic',100),payload->>'difficulty')
       on conflict(id) do update set prompt=excluded.prompt,choices=excluded.choices,kind=excluded.kind,correct=excluded.correct,
       correct_set=excluded.correct_set,marks=excluded.marks,topic=excluded.topic,difficulty=excluded.difficulty;
   end if;
   return (select coalesce(jsonb_agg(to_jsonb(bk)-'owner_id' order by bk.topic,bk.prompt),'[]') from examroom.bank bk where owner_id=p.id);
 end if;
 eid:=nullif(payload->>'examId','')::uuid;
 if eid is not null then
   select * into e from examroom.exams where id=eid for update;
   if e.id is null then raise exception 'Exam unavailable.'; end if;
 end if;
 if operation in ('assign','settings','announce','monitor','grade','publish_results') then
   if p.role<>'examiner' or e.owner_id is distinct from p.id then raise exception 'Exam unavailable.'; end if;
   update examroom.attempts set submitted_at=deadline where exam_id=eid and submitted_at is null and deadline<=clock_timestamp();
   if operation in ('assign','settings') then
     if e.published then raise exception 'Published exam questions and settings are locked.'; end if;
     if operation='assign' then
       select * into b from examroom.bank where id=(payload->>'questionId')::uuid and owner_id=p.id;
       if b.id is null then raise exception 'Question unavailable.'; end if;
       insert into examroom.questions(exam_id,position,prompt,choices,correct,marks,kind,correct_set,topic,difficulty)
       values(eid,(select coalesce(max(position),0)+1 from examroom.questions where exam_id=eid),b.prompt,b.choices,b.correct,b.marks,b.kind,b.correct_set,b.topic,b.difficulty);
     else update examroom.exams set randomize=(payload->>'randomize')::boolean where id=eid;
     end if;
   elsif operation='announce' then
     insert into examroom.announcements(exam_id,message) values(eid,trim(payload->>'message'));
   elsif operation='grade' then
     if e.results_published then raise exception 'Unpublish results before changing grades.'; end if;
     select * into a from examroom.attempts where id=(payload->>'attemptId')::uuid and exam_id=eid and submitted_at is not null for update;
     qid:=(payload->>'questionId')::uuid;
     if a.id is null or not exists(select 1 from examroom.questions where id=qid and exam_id=eid and kind='written' and (payload->>'grade')::numeric between 0 and marks)
       then raise exception 'Enter marks within the question maximum for a submitted attempt.'; end if;
     insert into examroom.responses(attempt_id,question_id,grade) values(a.id,qid,(payload->>'grade')::numeric)
       on conflict(attempt_id,question_id) do update set grade=excluded.grade;
   elsif operation='publish_results' then
     if (payload->>'published')::boolean and (exists(select 1 from examroom.attempts where exam_id=eid and submitted_at is null)
       or exists(select 1 from jsonb_array_elements(examroom.scores(eid)) s where (s->>'pending')::integer>0)) then raise exception 'Finalize attempts and grade all written responses before publishing.'; end if;
     update examroom.exams set results_published=(payload->>'published')::boolean where id=eid;
   end if;
   return jsonb_build_object('scores',examroom.scores(eid),'published',(select results_published from examroom.exams where id=eid),
     'attempts',(select coalesce(jsonb_agg(jsonb_build_object('id',at.id,'name',pr.name,'deadline',at.deadline,'submittedAt',at.submitted_at,
       'answered',(select count(*) from examroom.answers an where an.attempt_id=at.id and (an.choice is not null or exists(select 1 from examroom.responses r where r.attempt_id=at.id and r.question_id=an.question_id and (r.written<>'' or cardinality(r.selected)>0)))),
       'written',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'marks',q.marks,'response',r.written,'grade',r.grade) order by q.position),'[]') from examroom.questions q left join examroom.responses r on r.question_id=q.id and r.attempt_id=at.id where q.exam_id=eid and q.kind='written'),
       'incidents',(select coalesce(jsonb_agg(to_jsonb(i)-'attempt_id'),'[]') from examroom.incidents i where i.attempt_id=at.id)) order by pr.name),'[]')
       from examroom.attempts at join examroom.profiles pr on pr.id=at.candidate_id where at.exam_id=eid));
 end if;
 if operation in ('result','announcements','incident') then
   if p.role<>'candidate' or not e.published or not exists(select 1 from examroom.enrollments where exam_id=eid and candidate_id=p.id) then raise exception 'Exam unavailable.'; end if;
   if operation='result' then
     if not e.results_published then return jsonb_build_object('published',false); end if;
     return jsonb_build_object('published',true,'scores',(select coalesce(jsonb_agg(s-'candidate_id'),'[]') from jsonb_array_elements(examroom.scores(eid)) s where s->>'candidate_id'=p.id::text));
   elsif operation='announcements' then
     return (select coalesce(jsonb_agg(jsonb_build_object('message',message,'createdAt',created_at) order by created_at desc),'[]') from examroom.announcements where exam_id=eid);
   else
     select * into a from examroom.attempts where exam_id=eid and candidate_id=p.id and submitted_at is null and deadline>clock_timestamp();
     if a.id is not null and not exists(select 1 from examroom.incidents where attempt_id=a.id and created_at>clock_timestamp()-interval '10 seconds') then
       insert into examroom.incidents(attempt_id,event) values(a.id,payload->>'event');
     end if;
     return '{}'::jsonb;
   end if;
 end if;
 if operation='save' then
   select * into a from examroom.attempts where exam_id=eid and candidate_id=p.id for update;
   if a.id is not null and a.submitted_at is null and a.deadline>clock_timestamp() then
     qid:=(payload->>'questionId')::uuid;
     if exists(select 1 from examroom.questions where id=qid and exam_id=eid and kind<>'single') then
       selected:=array(select distinct value::integer from jsonb_array_elements_text(coalesce(payload->'selected','[]')) order by 1);
       if not selected <@ array[0,1,2,3] then raise exception 'Invalid answer choice.'; end if;
       insert into examroom.responses(attempt_id,question_id,selected,written)
       values(a.id,qid,selected,coalesce(payload->>'written',''))
       on conflict(attempt_id,question_id) do update set selected=excluded.selected,written=excluded.written;
     end if;
   end if;
 end if;
 result:=public.examroom_v1(operation,payload);
 if operation='dashboard' and p.role='candidate' then
   select coalesce(jsonb_agg(j.value || jsonb_build_object('submitted_at',at.submitted_at)),'[]') into rows
   from jsonb_array_elements(result->'exams') j left join examroom.attempts at
   on at.exam_id=(j.value->>'id')::uuid and at.candidate_id=p.id;
   result:=jsonb_set(result,'{exams}',rows);
 end if;
 if operation in ('start','resume') then
   select * into a from examroom.attempts where exam_id=eid and candidate_id=p.id;
   select coalesce(jsonb_agg((j.value || jsonb_build_object('kind',q.kind,'selected',coalesce(r.selected,'{}'::integer[]),'written',coalesce(r.written,'')))
      order by case when e.randomize then md5(a.id::text||q.id::text) else lpad(q.position::text,8,'0') end),'[]') into rows
     from jsonb_array_elements(result->'questions') j join examroom.questions q on q.id=(j.value->>'id')::uuid
     left join examroom.responses r on r.attempt_id=a.id and r.question_id=q.id;
   result:=jsonb_set(result,'{questions}',rows);
 end if;
 return result;
end $$;
revoke all on function public.examroom_request(text,jsonb) from public,anon;
grant execute on function public.examroom_request(text,jsonb) to authenticated;
