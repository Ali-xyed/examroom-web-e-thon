alter function public.examroom_request(text,jsonb) rename to examroom_v4;
revoke all on function public.examroom_v4(text,jsonb) from public,anon,authenticated;

create function public.examroom_request(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare profile examroom.profiles;
begin
 select * into profile from examroom.profiles where id=auth.uid();
 if profile.id is null or not profile.active then raise exception 'Account unavailable.'; end if;
 if operation='candidate_directory' then
   if profile.role<>'examiner' or not exists(
     select 1 from examroom.exams where id=(payload->>'examId')::uuid and owner_id=profile.id
   ) then raise exception 'Exam unavailable.'; end if;
   return (select coalesce(jsonb_agg(jsonb_build_object(
     'name',p.name,'email',u.email,'active',p.active,
     'enrolled',n.candidate_id is not null,'startedAt',a.started_at,'submittedAt',a.submitted_at
   ) order by p.name,u.email),'[]')
   from examroom.profiles p join auth.users u on u.id=p.id
   left join examroom.enrollments n on n.candidate_id=p.id and n.exam_id=(payload->>'examId')::uuid
   left join examroom.attempts a on a.candidate_id=p.id and a.exam_id=n.exam_id
   where p.role='candidate');
 end if;
 return public.examroom_v4(operation,payload);
end $$;
revoke all on function public.examroom_request(text,jsonb) from public,anon;
grant execute on function public.examroom_request(text,jsonb) to authenticated;
