-- Migration: 20261127000800_proctoring_ai.sql
-- Adds AI proctoring support: proctor_captures table, RLS, heartbeat next_capture_at,
-- and extends examroom_request with proctoring / leaderboard / AI-assist operations.

-- ============================================================
-- 1. Add columns to exams & allow audit_log to survive exam delete
-- ============================================================
alter table examroom.exams
  add column if not exists description text,
  add column if not exists proctoring_mode text not null default 'off'
    check(proctoring_mode in ('off','snapshots'));

alter table examroom.audit_log alter column exam_id drop not null;
alter table examroom.audit_log drop constraint if exists audit_log_exam_id_fkey;

-- ============================================================
-- 2. Create proctor_captures table
-- ============================================================
create table if not exists examroom.proctor_captures (
  id               uuid        primary key default gen_random_uuid(),
  attempt_id       uuid        not null references examroom.attempts,
  exam_id          uuid        not null references examroom.exams,
  candidate_id     uuid        not null references examroom.profiles,
  taken_at         timestamptz not null default clock_timestamp(),
  storage_path     text,
  flags            jsonb       not null default '[]',
  status           text        not null default 'pending'
                     check(status in ('pending','reviewed','missed','escalated')),
  reviewer_id      uuid        references examroom.profiles,
  reviewed_at      timestamptz,
  reviewer_note    text,
  image_deleted_at timestamptz
);

create index if not exists proctor_captures_exam
  on examroom.proctor_captures(exam_id, status, taken_at);
create index if not exists proctor_captures_attempt
  on examroom.proctor_captures(attempt_id, taken_at);

-- ============================================================
-- 3. RLS on proctor_captures
-- ============================================================
alter table examroom.proctor_captures enable row level security;

-- Revoke all from public roles
revoke all on examroom.proctor_captures from public, anon, authenticated;

-- Grant table-level to authenticated so policies can apply
grant select, insert, update on examroom.proctor_captures to authenticated;

-- Candidates: INSERT only for their own active attempt
drop policy if exists proctor_captures_candidate_insert on examroom.proctor_captures;
create policy proctor_captures_candidate_insert
  on examroom.proctor_captures
  for insert
  to authenticated
  with check (
    candidate_id = auth.uid()
    and exists (
      select 1 from examroom.attempts a
      where a.id = attempt_id
        and a.candidate_id = auth.uid()
        and a.submitted_at is null
        and a.deadline > clock_timestamp()
    )
  );

-- Candidates: NO SELECT (no policy = no access)

-- Examiners / admins: SELECT + UPDATE
drop policy if exists proctor_captures_examiner_select on examroom.proctor_captures;
create policy proctor_captures_examiner_select
  on examroom.proctor_captures
  for select
  to authenticated
  using (
    exists (
      select 1
      from examroom.exams e
      join examroom.profiles p on p.id = auth.uid()
      where e.id = exam_id
        and (e.owner_id = p.id or p.role = 'administrator')
        and p.active
    )
  );

drop policy if exists proctor_captures_examiner_update on examroom.proctor_captures;
create policy proctor_captures_examiner_update
  on examroom.proctor_captures
  for update
  to authenticated
  using (
    exists (
      select 1
      from examroom.exams e
      join examroom.profiles p on p.id = auth.uid()
      where e.id = exam_id
        and (e.owner_id = p.id or p.role = 'administrator')
        and p.active
    )
  );

-- ============================================================
-- 4. Storage bucket note
-- ============================================================
-- NOTE: Create a private Supabase storage bucket named "proctor-captures" via the
-- Supabase Dashboard or CLI.  Example CLI:
--   supabase storage buckets create proctor-captures --private

-- ============================================================
-- 5. Extend examroom_request (replace wrapper — previous version renamed to examroom_v7)
-- ============================================================
do $$ begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'examroom_v7'
  ) then
    alter function public.examroom_request(text, jsonb) rename to examroom_v7;
  end if;
end $$;
revoke all on function public.examroom_v7(text, jsonb) from public, anon, authenticated;

create or replace function public.examroom_request(
  operation text,
  payload   jsonb default '{}'
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  p           examroom.profiles;
  e           examroom.exams;
  a           examroom.attempts;
  cap         examroom.proctor_captures;
  eid         uuid;
  next_cap    timestamptz;
  result      jsonb;
  old_scores  jsonb;
  new_scores  jsonb;
  score_row   jsonb;
  score_val   numeric;
  total_val   numeric;
  avg_val     numeric;
  rank_val    bigint;
  total_cands bigint;
  pctile      numeric;
begin
  select * into p from examroom.profiles where id = auth.uid();
  if p.id is null or not p.active then raise exception 'Account unavailable.'; end if;

  eid := nullif(payload->>'examId', '')::uuid;

  -- ----------------------------------------------------------------
  -- create — also persist description & proctoring_mode
  -- ----------------------------------------------------------------
  if operation = 'create' then
    result := public.examroom_v7(operation, payload);
    update examroom.exams
       set description     = nullif(trim(coalesce(payload->>'description', '')), ''),
           proctoring_mode = case when payload->>'proctoring_mode' = 'snapshots' then 'snapshots' else 'off' end
     where id = (result->>'id')::uuid;
    return result;

  -- ----------------------------------------------------------------
  -- exam_settings — examiner updates description / proctoring_mode
  -- ----------------------------------------------------------------
  elsif operation = 'exam_settings' then
    if p.role <> 'examiner' then raise exception 'Access denied.'; end if;
    update examroom.exams
       set description     = coalesce(nullif(trim(coalesce(payload->>'description', '')), ''), description),
           proctoring_mode = case
             when payload ? 'proctoring_mode' then
               case when payload->>'proctoring_mode' = 'snapshots' then 'snapshots' else 'off' end
             else proctoring_mode
           end
     where id = eid and owner_id = p.id;
    if not found then raise exception 'Exam unavailable or access denied.'; end if;
    return '{"ok":true}'::jsonb;

  -- ----------------------------------------------------------------
  -- exam_delete — examiner/admin deletes an exam and its child rows
  -- ----------------------------------------------------------------
  elsif operation = 'exam_delete' then
    if p.role not in ('examiner', 'administrator') then raise exception 'Access denied.'; end if;
    select * into e from examroom.exams where id = eid;
    if e.id is null or (e.owner_id <> p.id and p.role <> 'administrator') then
      raise exception 'Exam unavailable.';
    end if;
    delete from examroom.proctor_captures where exam_id = eid;
    delete from examroom.datesheet_mail where exam_id = eid;
    delete from examroom.disputes where exam_id = eid;
    delete from examroom.disconnects where attempt_id in (select id from examroom.attempts where exam_id = eid);
    delete from examroom.incidents where attempt_id in (select id from examroom.attempts where exam_id = eid);
    delete from examroom.answer_timing where attempt_id in (select id from examroom.attempts where exam_id = eid);
    delete from examroom.grade_overrides where attempt_id in (select id from examroom.attempts where exam_id = eid);
    delete from examroom.responses where attempt_id in (select id from examroom.attempts where exam_id = eid);
    delete from examroom.answers where attempt_id in (select id from examroom.attempts where exam_id = eid);
    delete from examroom.attempt_questions where attempt_id in (select id from examroom.attempts where exam_id = eid);
    delete from examroom.attempts where exam_id = eid;
    delete from examroom.enrollments where exam_id = eid;
    delete from examroom.announcements where exam_id = eid;
    delete from examroom.questions where exam_id = eid;
    delete from public.examroom_live_events where exam_id = eid;
    delete from examroom.exams where id = eid;
    return '{"ok":true}'::jsonb;

  -- ----------------------------------------------------------------
  -- exam_description — examiner updates the exam description field
  -- ----------------------------------------------------------------
  elsif operation = 'exam_description' then
    if p.role <> 'examiner' then raise exception 'Access denied.'; end if;
    update examroom.exams
       set description = payload->>'description'
     where id = eid and owner_id = p.id;
    if not found then raise exception 'Exam unavailable or access denied.'; end if;
    return '{"ok":true}'::jsonb;

  -- ----------------------------------------------------------------
  -- proctor_schedule — returns next_capture_at for active attempt
  -- (candidates call this; a 2–6 min random interval from now)
  -- ----------------------------------------------------------------
  elsif operation = 'proctor_schedule' then
    select * into a
      from examroom.attempts
     where id = (payload->>'attemptId')::uuid
       and candidate_id = p.id
       and submitted_at is null
       and deadline > clock_timestamp();
    if a.id is null then raise exception 'Active attempt not found.'; end if;

    select * into e from examroom.exams where id = a.exam_id;
    if e.proctoring_mode <> 'snapshots' then
      return '{"next_capture_at":null}'::jsonb;
    end if;

    -- Random interval between 2 and 6 minutes
    next_cap := clock_timestamp()
                + make_interval(secs => 120 + floor(random() * 240)::int);
    return jsonb_build_object('next_capture_at', next_cap);

  -- ----------------------------------------------------------------
  -- proctor_review — examiner marks a capture reviewed
  -- ----------------------------------------------------------------
  elsif operation = 'proctor_review' then
    if p.role not in ('examiner', 'administrator') then
      raise exception 'Access denied.';
    end if;
    select pc.* into cap
      from examroom.proctor_captures pc
      join examroom.exams ex on ex.id = pc.exam_id
     where pc.id = (payload->>'captureId')::uuid
       and (ex.owner_id = p.id or p.role = 'administrator')
       and ex.id = eid;
    if cap.id is null then raise exception 'Capture unavailable.'; end if;

    update examroom.proctor_captures
       set status        = 'reviewed',
           reviewer_id   = p.id,
           reviewed_at   = clock_timestamp(),
           reviewer_note = payload->>'note'
     where id = cap.id;

    return jsonb_build_object(
      'ok', true,
      'capture', (select to_jsonb(pc) from examroom.proctor_captures pc where pc.id = cap.id)
    );

  -- ----------------------------------------------------------------
  -- proctor_captures — examiner fetches all captures for an exam,
  -- grouped by candidate
  -- ----------------------------------------------------------------
  elsif operation = 'proctor_captures' then
    if p.role not in ('examiner', 'administrator') then
      raise exception 'Access denied.';
    end if;
    select * into e from examroom.exams where id = eid;
    if e.id is null or (e.owner_id <> p.id and p.role <> 'administrator') then
      raise exception 'Exam unavailable.';
    end if;

    return jsonb_build_object(
      'candidates', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id',       pr.id,
            'name',     pr.name,
            'email',    pr.email,
            'captures', (
              select coalesce(jsonb_agg(
                jsonb_build_object(
                  'id',           pc.id,
                  'taken_at',     pc.taken_at,
                  'storage_path', pc.storage_path,
                  'flags',        pc.flags,
                  'status',       pc.status,
                  'reviewed_at',  pc.reviewed_at,
                  'reviewer_note',pc.reviewer_note
                ) order by pc.taken_at
              ), '[]')
              from examroom.proctor_captures pc
             where pc.exam_id  = eid
               and pc.candidate_id = pr.id
          )
        ) order by pr.name), '[]')
        from (
          select distinct pr2.id, pr2.name, u.email
            from examroom.proctor_captures pc2
            join examroom.profiles pr2 on pr2.id = pc2.candidate_id
            join auth.users u on u.id = pr2.id
           where pc2.exam_id = eid
        ) pr
      )
    );

  -- ----------------------------------------------------------------
  -- ai_grade_assist — placeholder; actual AI done in backend endpoint
  -- ----------------------------------------------------------------
  elsif operation = 'ai_grade_assist' then
    if p.role not in ('examiner', 'administrator') then
      raise exception 'Access denied.';
    end if;
    return jsonb_build_object(
      'suggested_marks', null,
      'rationale',       'AI grading available via backend endpoint.'
    );

  -- ----------------------------------------------------------------
  -- leaderboard — top candidates for an exam
  -- ----------------------------------------------------------------
  elsif operation = 'leaderboard' then
    select * into e from examroom.exams where id = eid;
    if e.id is null then raise exception 'Exam unavailable.'; end if;
    if p.role in ('examiner', 'administrator') then
      if e.owner_id <> p.id and p.role <> 'administrator' then
        raise exception 'Exam unavailable.';
      end if;
    elsif p.role = 'candidate' then
      if not e.results_published or not exists(
        select 1 from examroom.enrollments en where en.exam_id = eid and en.candidate_id = p.id
      ) then
        raise exception 'Results unavailable.';
      end if;
    else
      raise exception 'Access denied.';
    end if;

    return (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'rank',          t.rn,
          'userId',        case when p.role in ('examiner','administrator') or t.cid = p.id then t.cid else null end,
          'isCurrentUser', (t.cid = p.id),
          'name',          case when p.role in ('examiner','administrator') or t.cid = p.id then t.cname else 'Candidate' end,
          'score',         t.sc,
          'total',         t.tot,
          'percentile',    t.pct
        ) order by t.rn
      ), '[]')
      from (
        select
          (s->>'candidate_id')::uuid as cid,
          pr.name as cname,
          (s->>'score')::numeric as sc,
          (s->>'total')::numeric as tot,
          row_number() over (order by (s->>'score')::numeric desc, pr.name) as rn,
          round((100.0 * percent_rank() over (order by (s->>'score')::numeric))::numeric, 1) as pct
        from jsonb_array_elements(examroom.scores(eid)) s
        join examroom.profiles pr on pr.id = (s->>'candidate_id')::uuid
      ) t
    );

  -- ----------------------------------------------------------------
  -- result_comparison — candidate's score vs class average/percentile
  -- ----------------------------------------------------------------
  elsif operation = 'result_comparison' then
    select * into e from examroom.exams where id = eid;
    if e.id is null then raise exception 'Exam unavailable.'; end if;
    if not e.results_published and p.role = 'candidate' then
      raise exception 'Results not published yet.';
    end if;

    select
      (s->>'score')::numeric,
      (s->>'total')::numeric
    into score_val, total_val
    from jsonb_array_elements(examroom.scores(eid)) s
    where (s->>'candidate_id')::uuid = p.id
    limit 1;

    if score_val is null then raise exception 'Result not available.'; end if;

    select
      avg((s->>'score')::numeric),
      count(*)
    into avg_val, total_cands
    from jsonb_array_elements(examroom.scores(eid)) s;

    select
      count(*) filter (where (s->>'score')::numeric > score_val) + 1,
      round((100.0 * count(*) filter (where (s->>'score')::numeric < score_val)
            / nullif(total_cands, 0))::numeric, 1)
    into rank_val, pctile
    from jsonb_array_elements(examroom.scores(eid)) s;

    return jsonb_build_object(
      'score',            score_val,
      'total',            total_val,
      'classAvg',         round(avg_val::numeric, 2),
      'percentile',       coalesce(pctile, 0),
      'rank',             rank_val,
      'totalCandidates',  total_cands
    );

  -- ----------------------------------------------------------------
  -- score_mail_data — examiner fetches scores + emails to send PDFs
  -- ----------------------------------------------------------------
  elsif operation = 'score_mail_data' then
    if p.role not in ('examiner', 'administrator') then
      raise exception 'Access denied.';
    end if;
    select * into e from examroom.exams where id = eid;
    if e.id is null or (e.owner_id <> p.id and p.role <> 'administrator') then
      raise exception 'Exam unavailable.';
    end if;

    select avg((s->>'score')::numeric), count(*)
      into avg_val, total_cands
      from jsonb_array_elements(examroom.scores(eid)) s;

    return jsonb_build_object(
      'exam', jsonb_build_object('id', e.id, 'title', e.title, 'description', e.description),
      'classAvg', round(coalesce(avg_val, 0)::numeric, 2),
      'totalCandidates', coalesce(total_cands, 0),
      'candidates', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id',         (s->>'candidate_id')::uuid,
            'name',       pr.name,
            'email',      u.email,
            'score',      (s->>'score')::numeric,
            'total',      (s->>'total')::numeric,
            'rank',       (select count(*) + 1 from jsonb_array_elements(examroom.scores(eid)) s2 where (s2->>'score')::numeric > (s->>'score')::numeric),
            'percentile', round((100.0 * (select count(*) from jsonb_array_elements(examroom.scores(eid)) s2 where (s2->>'score')::numeric < (s->>'score')::numeric) / nullif(total_cands, 0))::numeric, 1)
          )
        ), '[]')
        from jsonb_array_elements(examroom.scores(eid)) s
        join examroom.profiles pr on pr.id = (s->>'candidate_id')::uuid
        join auth.users u on u.id = pr.id
        where pr.active and u.email !~* '\.(example|test|invalid)$'
      )
    );

  -- ----------------------------------------------------------------
  -- admin_audit — platform-wide audit log for administrators
  -- ----------------------------------------------------------------
  elsif operation = 'admin_audit' then
    if p.role <> 'administrator' then
      raise exception 'Administrators only.';
    end if;
    return (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.id desc), '[]')
      from (
        select l.id, l.exam_id, ex.title as exam_title, l.action, l.entity_id, l.before_data, l.after_data, l.created_at, pr.name as actor
        from examroom.audit_log l
        left join examroom.profiles pr on pr.id = l.actor_id
        left join examroom.exams ex on ex.id = l.exam_id
        order by l.id desc
        limit 500
      ) t
    );

  end if;

  -- ----------------------------------------------------------------
  -- Fall through to previous version for all other operations
  -- Also: inject attemptId / next_capture_at for start, resume, save, heartbeat
  -- ----------------------------------------------------------------
  result := public.examroom_v7(operation, payload);

  if operation in ('start', 'resume', 'save', 'heartbeat') then
    select * into a
      from examroom.attempts
     where (
       (eid is not null and exam_id = eid)
       or (payload->>'attemptId' is not null and id = (payload->>'attemptId')::uuid)
     )
       and candidate_id = p.id
     limit 1;

    if a.id is not null then
      if operation in ('start', 'resume') then
        result := result || jsonb_build_object('attemptId', a.id);
        -- Always inject proctoring_mode so the client knows whether to enable camera
        select * into e from examroom.exams where id = a.exam_id;
        result := result || jsonb_build_object('proctoring_mode', e.proctoring_mode);
      end if;
      if a.submitted_at is null and a.deadline > clock_timestamp() then
        if e.id is null then
          select * into e from examroom.exams where id = a.exam_id;
        end if;
        if e.proctoring_mode = 'snapshots' then
          next_cap := clock_timestamp()
                      + make_interval(secs => 120 + floor(random() * 240)::int);
          result := result || jsonb_build_object('next_capture_at', next_cap);
        end if;
      end if;
    end if;
  end if;

  return result;
end $$;

revoke all on function public.examroom_request(text, jsonb) from public, anon;
grant execute on function public.examroom_request(text, jsonb) to authenticated;

-- ============================================================
-- 7. Seed data comment (sample proctored exam)
-- ============================================================
-- Sample INSERT for a proctored exam:
-- insert into examroom.exams(title, description, instructions, duration, opens_at, closes_at, owner_id, proctoring_mode)
-- values(
--   'Sample Proctored Exam',
--   'This is a remotely proctored assessment. Your webcam snapshots will be reviewed.',
--   'Ensure you are in a quiet, well-lit room. No additional materials allowed.',
--   60,
--   now() + interval '1 day',
--   now() + interval '2 days',
--   '<examiner-uuid>',
--   'snapshots'
-- );

-- ============================================================
-- 8. pg_cron cleanup job
-- ============================================================
-- Cleanup: delete images of pending captures older than 14 days for completed exams
-- This runs as a pg_cron job if pg_cron is available
do $$ begin
  if exists(select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('proctor-cleanup', '0 3 * * *', '
      update examroom.proctor_captures
      set image_deleted_at = clock_timestamp(), storage_path = null, status = ''reviewed''
      where status = ''pending''
      and taken_at < clock_timestamp() - interval ''14 days''
      and exists(select 1 from examroom.exams e where e.id = exam_id and e.results_published)
      and status != ''escalated''
    ');
  end if;
end $$;
