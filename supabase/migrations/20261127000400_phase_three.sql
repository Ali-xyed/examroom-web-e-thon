alter table examroom.responses add column revision bigint not null default 0;
create table examroom.reports (
 token uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references examroom.attempts,
 score numeric not null, total numeric not null,
 issued_at timestamptz not null default now()
);
alter table examroom.reports enable row level security;
create index reports_attempt on examroom.reports(attempt_id);
alter function public.examroom_request(text,jsonb) rename to examroom_v2;
revoke all on function public.examroom_v2(text,jsonb) from public,anon,authenticated;

create function public.verify_report(code uuid) returns jsonb
language sql security definer set search_path='' as $$
 select coalesce((
 select jsonb_build_object('valid',true,'issuedAt',r.issued_at)
 from examroom.reports r join examroom.attempts a on a.id=r.attempt_id
 join examroom.exams e on e.id=a.exam_id
 where r.token=code and e.results_published and exists(
 select 1 from jsonb_array_elements(examroom.scores(e.id)) s where s->>'id'=a.id::text
 and (s->>'score')::numeric=r.score and (s->>'total')::numeric=r.total)
 ),'{"valid":false}'::jsonb)
$$;
revoke all on function public.verify_report(uuid) from public;
grant execute on function public.verify_report(uuid) to anon,authenticated;

create function public.examroom_request(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare p examroom.profiles; e examroom.exams; a examroom.attempts;
 eid uuid; item jsonb; result jsonb; rownum integer:=0; qid uuid; rev bigint; previous bigint;
begin
 select * into p from examroom.profiles where id=auth.uid();
 if p.id is null or not p.active then raise exception 'Account unavailable.'; end if;
 eid:=nullif(payload->>'examId','')::uuid;
 if operation='bulk_import' then
   if p.role not in ('administrator','examiner') then raise exception 'Import access denied.'; end if;
   if jsonb_typeof(payload->'rows') is distinct from 'array' or jsonb_array_length(payload->'rows') not between 1 and 200 then raise exception 'Import between 1 and 200 JSON records.'; end if;
   for item in select value from jsonb_array_elements(payload->'rows') loop
     rownum:=rownum+1;
     begin
       if p.role='administrator' then
         if coalesce(length(trim(item->>'name')),0)=0 or coalesce(length(item->>'password'),0)<12 or coalesce(item->>'email','') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Provide name, valid email, and a password of at least 12 characters.'; end if;
         perform public.examroom_v2('admin_save',jsonb_build_object('name',item->>'name','email',item->>'email','password',item->>'password','role','candidate','active',true));
       else
         if coalesce(item->>'kind','') not in ('single','multiple','written') or jsonb_typeof(item->'choices') is distinct from 'array' then raise exception 'Provide kind and an array of four choices.'; end if;
         perform public.examroom_v2('bank_save',item-'id');
       end if;
     exception when others then raise exception 'Row %: %. No records were imported.',rownum,sqlerrm;
     end;
   end loop;
   return jsonb_build_object('imported',rownum);
 end if;
 if operation in ('sandbox','analytics','report') then
   select * into e from examroom.exams where id=eid;
   if e.id is null then raise exception 'Exam unavailable.'; end if;
   if operation='sandbox' then
     if p.role<>'examiner' or e.owner_id<>p.id then raise exception 'Exam unavailable.'; end if;
     return jsonb_build_object('sandbox',true,'exam',to_jsonb(e)-'owner_id','serverTime',clock_timestamp(),
       'deadline',clock_timestamp()+make_interval(mins=>e.duration),
       'questions',(select jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'choices',q.choices,'kind',q.kind,'marks',q.marks,'choice',null,'selected','[]'::jsonb,'written','','flagged',false) order by q.position)
       from examroom.questions q where exam_id=eid));
   elsif operation='analytics' then
     if p.role<>'examiner' or e.owner_id<>p.id then raise exception 'Exam unavailable.'; end if;
     return (select coalesce(jsonb_agg(to_jsonb(stats)),'[]') from (
       select q.id,q.prompt,q.kind,q.marks,count(att.id) attempts,
       count(att.id) filter(where ans.choice is null and coalesce(cardinality(r.selected),0)=0 and coalesce(r.written,'')='') skipped,
       count(att.id) filter(where (q.kind='single' and ans.choice is not null and ans.choice<>q.correct)
       or (q.kind='multiple' and cardinality(r.selected)>0 and
       (select array_agg(x order by x) from unnest(r.selected) x)<>(select array_agg(x order by x) from unnest(q.correct_set) x))) incorrect,
       avg(r.grade) filter(where q.kind='written') average_written_mark
       from examroom.questions q left join examroom.attempts att on att.exam_id=q.exam_id and att.submitted_at is not null
       left join examroom.answers ans on ans.attempt_id=att.id and ans.question_id=q.id
       left join examroom.responses r on r.attempt_id=att.id and r.question_id=q.id
       where q.exam_id=eid group by q.id order by q.position)stats);
   else
     if p.role='examiner' and e.owner_id=p.id then
       return jsonb_build_object('title',e.title,'scores',examroom.scores(eid),'examiner',true);
     end if;
     if p.role<>'candidate' or not e.results_published then raise exception 'Published result required.'; end if;
     select * into a from examroom.attempts where exam_id=eid and candidate_id=p.id and submitted_at is not null;
     if a.id is null then raise exception 'Submitted attempt required.'; end if;
     select s into item from jsonb_array_elements(examroom.scores(eid)) s where s->>'id'=a.id::text;
     insert into examroom.reports(attempt_id,score,total) values(a.id,(item->>'score')::numeric,(item->>'total')::numeric)
     returning jsonb_build_object('token',token,'issuedAt',issued_at) into result;
     return result||jsonb_build_object('title',e.title,'name',p.name,'score',item->'score','total',item->'total');
   end if;
 end if;
 if operation='save' then
   select * into a from examroom.attempts where exam_id=eid and candidate_id=p.id for update;
   if a.id is not null and a.submitted_at is null and a.deadline>clock_timestamp() then
     qid:=(payload->>'questionId')::uuid;
     rev:=coalesce((payload->>'revision')::bigint,0);
     select revision into previous from examroom.responses where attempt_id=a.id and question_id=qid;
     if rev>0 and rev<=coalesce(previous,0) then return jsonb_build_object('submittedAt',null,'serverTime',clock_timestamp(),'stale',true); end if;
     result:=public.examroom_v2(operation,payload);
     if rev>0 then
       insert into examroom.responses(attempt_id,question_id,revision) values(a.id,qid,rev)
       on conflict(attempt_id,question_id) do update set revision=excluded.revision;
     end if;
     return result;
   end if;
 end if;
 return public.examroom_v2(operation,payload);
end $$;
revoke all on function public.examroom_request(text,jsonb) from public,anon;
grant execute on function public.examroom_request(text,jsonb) to authenticated;
