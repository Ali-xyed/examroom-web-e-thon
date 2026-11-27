alter function public.examroom_request(text,jsonb) rename to examroom_v3;
revoke all on function public.examroom_v3(text,jsonb) from public,anon,authenticated;

create function public.examroom_request(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare p examroom.profiles; q examroom.questions; cleaned jsonb:=payload; item jsonb; row_number integer:=0;
begin
 select * into p from examroom.profiles where id=auth.uid();
 if p.id is null or not p.active then raise exception 'Account unavailable.'; end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Provide an object containing the request fields.'; end if;
 if operation is null or operation not in (
 'dashboard','create','enroll','publish','manage','start','resume','save','submit',
 'admin_list','admin_save','bank','bank_save','assign','settings','announce','monitor','grade',
 'publish_results','result','announcements','incident','bulk_import','sandbox','analytics','report'
 ) then raise exception 'Action unavailable.'; end if;
 if operation='bulk_import' then
   if p.role not in ('administrator','examiner') then raise exception 'Import access denied.'; end if;
   if jsonb_typeof(payload->'rows') is distinct from 'array' then raise exception 'Provide a JSON array of records.'; end if;
   if jsonb_array_length(payload->'rows') not between 1 and 200 then raise exception 'Import between 1 and 200 records.'; end if;
   for item in select value from jsonb_array_elements(payload->'rows') loop
     row_number:=row_number+1;
     begin
       if p.role='administrator' then
         perform public.examroom_request('admin_save',jsonb_build_object(
           'name',item->>'name','email',item->>'email','password',item->>'password','role','candidate','active',true));
       else
         perform public.examroom_request('bank_save',item-'id');
       end if;
     exception when others then raise exception 'Row %: %. No records were imported.',row_number,sqlerrm;
     end;
   end loop;
   return jsonb_build_object('imported',row_number);
 end if;
 if operation='admin_save' then
   if p.role<>'administrator' then raise exception 'Administrator access required.'; end if;
   if coalesce(length(trim(payload->>'name')),0) not between 1 and 100
      or coalesce(payload->>'role','') not in ('administrator','examiner','candidate')
      or jsonb_typeof(payload->'active') is distinct from 'boolean' then raise exception 'Enter a name, role, and active account setting.'; end if;
   if nullif(payload->>'id','') is null and (
     coalesce(payload->>'email','') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or coalesce(length(payload->>'password'),0)<12
   ) then raise exception 'Provide a valid email and password of at least 12 characters.'; end if;
 end if;
 if operation='bank_save' then
   if p.role<>'examiner' then raise exception 'Examiner access required.'; end if;
   if coalesce(payload->>'kind','') not in ('single','multiple','written')
      or coalesce(payload->>'difficulty','') not in ('easy','medium','hard')
      or coalesce(length(trim(payload->>'prompt')),0) not between 1 and 2000
      or coalesce(length(trim(payload->>'topic')),0) not between 1 and 100 then raise exception 'Provide a question, topic, valid type, and difficulty.'; end if;
   if jsonb_typeof(payload->'choices') is distinct from 'array' then raise exception 'Provide four answer choices.'; end if;
   if jsonb_array_length(payload->'choices')<>4 or exists(
     select 1 from jsonb_array_elements(payload->'choices') v
     where jsonb_typeof(v) is distinct from 'string' or length(trim(v#>>'{}')) not between 1 and 500
   ) then raise exception 'Provide four answer choices of 1 to 500 characters.'; end if;
 end if;
 if operation='save' then
   select question.* into q from examroom.questions question
   where question.id=(payload->>'questionId')::uuid and question.exam_id=(payload->>'examId')::uuid
   and exists(select 1 from examroom.attempts at where at.exam_id=question.exam_id and at.candidate_id=p.id);
   if q.kind='single' then
     cleaned:=payload||jsonb_build_object('selected','[]'::jsonb,'written','');
   elsif q.kind='multiple' then
     if jsonb_typeof(payload->'selected') is distinct from 'array' then raise exception 'Select answer choices as an array.'; end if;
     cleaned:=payload||jsonb_build_object('choice',null,'written','');
   elsif q.kind='written' then
     if jsonb_typeof(payload->'written') is distinct from 'string' then raise exception 'Provide a written response as text.'; end if;
     cleaned:=payload||jsonb_build_object('choice',null,'selected','[]'::jsonb);
   end if;
 end if;
 return public.examroom_v3(operation,cleaned);
end $$;
revoke all on function public.examroom_request(text,jsonb) from public,anon;
grant execute on function public.examroom_request(text,jsonb) to authenticated;
