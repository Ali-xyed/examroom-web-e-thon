create schema if not exists examroom;
revoke all on schema examroom from public, anon, authenticated;

create table examroom.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('administrator', 'examiner', 'candidate')),
  name text not null
);

create table examroom.exams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references examroom.profiles,
  title text not null check (length(trim(title)) between 1 and 150),
  instructions text not null check (length(instructions) <= 5000),
  opens_at timestamptz not null,
  closes_at timestamptz not null check (closes_at > opens_at and isfinite(closes_at)),
  duration integer not null check (duration between 1 and 480),
  published boolean not null default false,
  check (isfinite(opens_at))
);

create table examroom.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references examroom.exams,
  position integer not null,
  prompt text not null check (length(trim(prompt)) between 1 and 2000),
  choices text[] not null check (cardinality(choices) = 4),
  correct integer not null check (correct between 0 and 3),
  marks integer not null check (marks between 1 and 100),
  unique (exam_id, position)
);

create table examroom.enrollments (
  exam_id uuid not null references examroom.exams,
  candidate_id uuid not null references examroom.profiles,
  primary key (exam_id, candidate_id)
);

create table examroom.attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null,
  candidate_id uuid not null,
  started_at timestamptz not null,
  deadline timestamptz not null,
  submitted_at timestamptz,
  unique (exam_id, candidate_id),
  foreign key (exam_id, candidate_id) references examroom.enrollments
);

create table examroom.answers (
  attempt_id uuid not null references examroom.attempts,
  question_id uuid not null references examroom.questions,
  choice integer check (choice between 0 and 3),
  flagged boolean not null default false,
  primary key (attempt_id, question_id)
);

create index exams_owner_idx on examroom.exams(owner_id);
create index enrollments_candidate_idx on examroom.enrollments(candidate_id);
create index answers_question_idx on examroom.answers(question_id);

alter table examroom.profiles enable row level security;
alter table examroom.exams enable row level security;
alter table examroom.questions enable row level security;
alter table examroom.enrollments enable row level security;
alter table examroom.attempts enable row level security;
alter table examroom.answers enable row level security;

create function public.examroom_request(operation text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  profile examroom.profiles;
  exam examroom.exams;
  attempt examroom.attempts;
  exam_id uuid;
  question_id uuid;
  candidate_id uuid;
  instant timestamptz;
  entry jsonb;
  choices text[];
  position integer := 0;
  result jsonb;
begin
  select p.* into profile from examroom.profiles p where p.id = auth.uid();
  if profile.id is null then raise exception 'No Examroom role is assigned.'; end if;

  if operation = 'dashboard' then
    select coalesce(jsonb_agg(to_jsonb(e) - 'owner_id' order by e.opens_at desc), '[]')
      into result
      from examroom.exams e
      where (profile.role = 'examiner' and e.owner_id = profile.id)
        or profile.role = 'administrator'
        or (profile.role = 'candidate' and e.published and exists (
          select 1 from examroom.enrollments n where n.exam_id = e.id and n.candidate_id = profile.id));
    return jsonb_build_object('profile', to_jsonb(profile) - 'id', 'exams', result, 'serverTime', clock_timestamp());
  end if;

  if operation = 'create' and profile.role = 'examiner' then
    if jsonb_typeof(payload->'questions') is distinct from 'array' then
      raise exception 'Add at least one question.';
    end if;
    if jsonb_array_length(payload->'questions') not between 1 and 50 then
      raise exception 'Add between 1 and 50 questions.';
    end if;
    insert into examroom.exams(owner_id, title, instructions, opens_at, closes_at, duration)
      values (profile.id, trim(payload->>'title'), coalesce(payload->>'instructions', ''),
        (payload->>'opensAt')::timestamptz, (payload->>'closesAt')::timestamptz,
        (payload->>'duration')::integer)
      returning * into exam;
    for entry in select value from jsonb_array_elements(payload->'questions') loop
      position := position + 1;
      select array_agg(trim(c.value) order by c.ordinality) into choices
        from jsonb_array_elements_text(entry->'choices') with ordinality c(value, ordinality);
      if cardinality(choices) is distinct from 4 or exists (
        select 1 from unnest(choices) c where c is null or length(c) not between 1 and 500
      ) then raise exception 'Each question requires four choices of 1 to 500 characters.'; end if;
      insert into examroom.questions(exam_id, position, prompt, choices, correct, marks)
        values (exam.id, position, trim(entry->>'prompt'), choices,
          (entry->>'correct')::integer, (entry->>'marks')::integer);
    end loop;
    return jsonb_build_object('id', exam.id);
  end if;

  exam_id := (payload->>'examId')::uuid;
  select e.* into exam from examroom.exams e where e.id = exam_id;
  if exam.id is null then raise exception 'Exam unavailable.'; end if;

  if profile.role = 'examiner' and exam.owner_id = profile.id then
    if operation = 'enroll' then
      select p.id into candidate_id from examroom.profiles p join auth.users u on u.id = p.id
        where p.role = 'candidate' and lower(u.email) = lower(trim(payload->>'email'));
      if candidate_id is null then raise exception 'No candidate matches that email.'; end if;
      insert into examroom.enrollments values (exam.id, candidate_id) on conflict do nothing;
    elsif operation = 'publish' then
      if exam.closes_at <= clock_timestamp() then raise exception 'The exam window has already closed.'; end if;
      update examroom.exams e set published = true where e.id = exam.id returning * into exam;
    elsif operation <> 'manage' then
      raise exception 'Action unavailable.';
    end if;
    -- Realize expired attempts when an examiner reviews this exam.
    update examroom.attempts a set submitted_at = a.deadline
      where a.exam_id = exam.id and a.submitted_at is null and a.deadline <= clock_timestamp();
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.name, 'email', u.email, 'startedAt', a.started_at, 'submittedAt', a.submitted_at
    ) order by p.name), '[]') into result
      from examroom.enrollments n join examroom.profiles p on p.id = n.candidate_id
      join auth.users u on u.id = p.id
      left join examroom.attempts a on a.exam_id = n.exam_id and a.candidate_id = n.candidate_id
      where n.exam_id = exam.id;
    return jsonb_build_object('exam', to_jsonb(exam) - 'owner_id', 'candidates', result,
      'questions', (select coalesce(jsonb_agg(jsonb_build_object(
        'prompt', q.prompt, 'marks', q.marks) order by q.position), '[]')
        from examroom.questions q where q.exam_id = exam.id));
  end if;

  if profile.role <> 'candidate' or not exam.published or not exists (
    select 1 from examroom.enrollments n where n.exam_id = exam.id and n.candidate_id = profile.id
  ) then raise exception 'Exam unavailable.'; end if;
  if operation not in ('start', 'resume', 'save', 'submit') then raise exception 'Action unavailable.'; end if;

  instant := clock_timestamp();
  if operation = 'start' and instant >= exam.opens_at and instant < exam.closes_at then
    insert into examroom.attempts(exam_id, candidate_id, started_at, deadline)
      values (exam.id, profile.id, instant, least(exam.closes_at, instant + make_interval(mins => exam.duration)))
      on conflict do nothing;
  end if;
  select a.* into attempt from examroom.attempts a
    where a.exam_id = exam.id and a.candidate_id = profile.id for update;
  if attempt.id is null then raise exception 'No attempt is available. Check the exam window.'; end if;

  instant := clock_timestamp();
  if attempt.submitted_at is null and (instant >= attempt.deadline or operation = 'submit') then
    update examroom.attempts a set submitted_at = least(instant, a.deadline)
      where a.id = attempt.id returning * into attempt;
  end if;
  if operation = 'save' and attempt.submitted_at is null then
    question_id := (payload->>'questionId')::uuid;
    if not exists (select 1 from examroom.questions q where q.id = question_id and q.exam_id = exam.id)
      then raise exception 'Question unavailable.'; end if;
    insert into examroom.answers values (attempt.id, question_id, (payload->>'choice')::integer,
      coalesce((payload->>'flagged')::boolean, false))
      on conflict on constraint answers_pkey do update set choice = excluded.choice, flagged = excluded.flagged;
  end if;
  if operation in ('save', 'submit') then
    return jsonb_build_object('submittedAt', attempt.submitted_at, 'serverTime', instant);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'prompt', q.prompt, 'choices', q.choices, 'marks', q.marks,
    'choice', a.choice, 'flagged', coalesce(a.flagged, false)
  ) order by q.position), '[]') into result
  from examroom.questions q left join examroom.answers a on a.question_id = q.id and a.attempt_id = attempt.id
  where q.exam_id = exam.id;
  return jsonb_build_object('exam', to_jsonb(exam) - 'owner_id', 'questions', result,
    'deadline', attempt.deadline, 'submittedAt', attempt.submitted_at, 'serverTime', instant);
end
$$;

revoke all on function public.examroom_request(text, jsonb) from public, anon, authenticated;
grant execute on function public.examroom_request(text, jsonb) to authenticated;
