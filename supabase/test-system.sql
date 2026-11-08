-- =====================================================================
--  ONLINE TEST SYSTEM v2 — marking scheme, attempt limits, autosave,
--  resume, question images and a SAMPLE test
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Run after setup.sql, free-resources.sql and test-analytics.sql.)
--
--  How a test runs now (all checked on the SERVER):
--   start_test()          → checks access (free / bought / admin) and the
--                           attempt limit, creates (or RESUMES) an attempt,
--                           fixes the end time, sends questions WITHOUT answers
--   save_test_progress()  → autosave of answers / "marked for review" / times
--   submit_test_attempt() → scores on the server (marks per correct answer,
--                           minus negative marks for wrong ones) and only then
--                           returns the report with correct answers
--   Time is enforced by the server: answers sent after the end time (+2 min
--   grace) are ignored and the last autosaved answers are scored instead.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New settings on tests and questions
-- ---------------------------------------------------------------------
alter table public.tests add column if not exists subjects          text[] not null default '{}';
alter table public.tests add column if not exists marks_per_correct integer not null default 1;
alter table public.tests add column if not exists negative_marks    numeric(5,2) not null default 0;
alter table public.tests add column if not exists max_attempts      integer;           -- empty = unlimited
alter table public.tests add column if not exists instructions      text;
alter table public.tests add column if not exists is_sample         boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tests_marking_check') then
    alter table public.tests add constraint tests_marking_check
      check (marks_per_correct between 1 and 100 and negative_marks >= 0 and negative_marks <= 100
             and (max_attempts is null or max_attempts between 1 and 100)
             and (instructions is null or char_length(instructions) <= 3000));
  end if;
end $$;

alter table public.questions add column if not exists image_url text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'questions_image_check') then
    alter table public.questions add constraint questions_image_check
      check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 500));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Attempts: fractional scores (negative marking), end time, autosave
-- ---------------------------------------------------------------------
alter table public.test_attempts alter column score type numeric(8,2);
alter table public.test_attempts add column if not exists ends_at       timestamptz;
alter table public.test_attempts add column if not exists marked        jsonb not null default '[]'::jsonb;  -- ["<question id>", …]
alter table public.test_attempts add column if not exists last_saved_at timestamptz;
create index if not exists test_attempts_open_idx on public.test_attempts (user_id, test_id) where submitted_at is null;

-- ---------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------
-- Only real answers for this test's questions: {"<id>": 0..3}
create or replace function public.clean_test_answers(p_test uuid, p_answers jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(q.id::text, (p_answers ->> q.id::text)::int), '{}'::jsonb)
    from public.questions q
   where q.test_id = p_test
     and jsonb_typeof(p_answers) = 'object'
     and jsonb_typeof(p_answers -> q.id::text) = 'number'
     and (p_answers ->> q.id::text) in ('0', '1', '2', '3');
$$;

create or replace function public.clean_test_marked(p_test uuid, p_marked jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(q.id::text), '[]'::jsonb)
    from public.questions q
   where q.test_id = p_test and jsonb_typeof(p_marked) = 'array' and p_marked ? q.id::text;
$$;

create or replace function public.clean_test_times(p_test uuid, p_times jsonb, p_max integer)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(q.id::text, least(greatest(round((p_times ->> q.id::text)::numeric), 0), p_max)), '{}'::jsonb)
    from public.questions q
   where q.test_id = p_test and jsonb_typeof(p_times) = 'object' and jsonb_typeof(p_times -> q.id::text) = 'number';
$$;

-- Score = marks of correct answers − negative marks × wrong answers
create or replace function public.score_test_answers(p_test uuid, p_answers jsonb)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(q.marks) filter (where (p_answers ->> q.id::text) = q.correct_option::text), 0)
       - (select negative_marks from public.tests where id = p_test)
         * count(*) filter (where p_answers ? q.id::text and (p_answers ->> q.id::text) <> q.correct_option::text)
    from public.questions q
   where q.test_id = p_test;
$$;

-- Close one attempt (scored from the given answers)
create or replace function public.finish_attempt(p_attempt uuid, p_answers jsonb, p_times jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare a public.test_attempts; t public.tests; v_end timestamptz;
begin
  select * into a from public.test_attempts where id = p_attempt for update;
  if a.submitted_at is not null then return; end if;
  select * into t from public.tests where id = a.test_id;
  v_end := least(now(), coalesce(a.ends_at, now()));
  update public.test_attempts
     set answers = p_answers,
         question_times = coalesce(p_times, question_times),
         score = public.score_test_answers(a.test_id, p_answers),
         submitted_at = v_end,
         time_taken_seconds = greatest(0, extract(epoch from (v_end - a.started_at))::int)
   where id = p_attempt;
end;
$$;

-- Attempts whose time ran out (+2 min) are closed with their last autosave
create or replace function public.finalize_my_expired_attempts()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select id, answers, question_times from public.test_attempts
            where user_id = auth.uid() and submitted_at is null and ends_at is not null and ends_at + interval '2 minutes' < now()
  loop
    perform public.finish_attempt(r.id, r.answers, r.question_times);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Start or resume a test
-- ---------------------------------------------------------------------
create or replace function public.start_test(p_test_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.tests;
  a public.test_attempts;
  used integer;
begin
  t := public.assert_can_attempt(p_test_id);   -- login + free / bought / admin
  if auth.uid() is null then raise exception 'Please log in to take this test.'; end if;
  perform public.finalize_my_expired_attempts();

  select * into a from public.test_attempts
   where user_id = auth.uid() and test_id = t.id and submitted_at is null
   order by started_at desc limit 1;

  if not found then
    select count(*) into used from public.test_attempts where user_id = auth.uid() and test_id = t.id;
    if t.max_attempts is not null and used >= t.max_attempts and not public.is_admin() then
      raise exception 'You have used all % attempt(s) for this test.', t.max_attempts;
    end if;
    if not exists (select 1 from public.questions where test_id = t.id) then
      raise exception 'This test has no questions yet.';
    end if;
    insert into public.test_attempts (user_id, test_id, answers, score, started_at, ends_at, marked, question_times)
    values (auth.uid(), t.id, '{}'::jsonb, 0, now(), now() + make_interval(mins => t.duration_minutes), '[]'::jsonb, '{}'::jsonb)
    returning * into a;
  end if;

  select count(*) into used from public.test_attempts where user_id = auth.uid() and test_id = t.id;
  return jsonb_build_object(
    'attempt_id', a.id,
    'test_id', t.id,
    'title', t.title,
    'type', t.type,
    'subjects', to_jsonb(t.subjects),
    'duration_minutes', t.duration_minutes,
    'total_marks', t.total_marks,
    'marks_per_correct', t.marks_per_correct,
    'negative_marks', t.negative_marks,
    'max_attempts', t.max_attempts,
    'attempts_used', used,
    'started_at', a.started_at,
    'ends_at', a.ends_at,
    'server_now', now(),
    'answers', a.answers,
    'marked', a.marked,
    'question_times', coalesce(a.question_times, '{}'::jsonb),
    -- NO correct answers or explanations here
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'options', q.options, 'marks', q.marks,
                                          'subject', q.subject, 'topic', q.topic, 'image_url', q.image_url)
                       order by q.sort_order, q.created_at)
        from public.questions q where q.test_id = t.id), '[]'::jsonb)
  );
end;
$$;

-- Before starting: the instructions screen (no questions, no answers)
create or replace function public.test_overview(p_test_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.tests; used integer; open_attempt uuid; qn integer;
begin
  t := public.assert_can_attempt(p_test_id);
  perform public.finalize_my_expired_attempts();
  select count(*) into used from public.test_attempts where user_id = auth.uid() and test_id = t.id;
  select id into open_attempt from public.test_attempts where user_id = auth.uid() and test_id = t.id and submitted_at is null limit 1;
  select count(*) into qn from public.questions where test_id = t.id;
  return jsonb_build_object(
    'test_id', t.id, 'title', t.title, 'type', t.type, 'subjects', to_jsonb(t.subjects), 'duration_minutes', t.duration_minutes,
    'total_marks', t.total_marks, 'questions', qn, 'marks_per_correct', t.marks_per_correct, 'negative_marks', t.negative_marks,
    'max_attempts', t.max_attempts, 'attempts_used', used, 'in_progress', open_attempt is not null,
    'instructions', t.instructions, 'is_free', t.is_free, 'is_sample', t.is_sample);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Autosave (every few seconds while the test is open)
-- ---------------------------------------------------------------------
create or replace function public.save_test_progress(p_attempt uuid, p_answers jsonb, p_marked jsonb default null, p_times jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.test_attempts; t public.tests;
begin
  select * into a from public.test_attempts where id = p_attempt for update;
  if not found or a.user_id <> auth.uid() then raise exception 'Attempt not found.'; end if;
  if a.submitted_at is not null then return jsonb_build_object('ok', false, 'submitted', true); end if;
  if a.ends_at is not null and now() > a.ends_at + interval '2 minutes' then
    return jsonb_build_object('ok', false, 'time_over', true);
  end if;
  select * into t from public.tests where id = a.test_id;
  update public.test_attempts
     set answers = public.clean_test_answers(a.test_id, p_answers),
         marked = case when p_marked is null then marked else public.clean_test_marked(a.test_id, p_marked) end,
         question_times = case when p_times is null then question_times else public.clean_test_times(a.test_id, p_times, t.duration_minutes * 60) end,
         last_saved_at = now()
   where id = a.id;
  return jsonb_build_object('ok', true, 'saved_at', now());
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Submit (manual or when the time is up) → report
-- ---------------------------------------------------------------------
create or replace function public.submit_test_attempt(p_attempt uuid, p_answers jsonb default null, p_times jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.test_attempts; t public.tests; v_answers jsonb; v_times jsonb;
begin
  select * into a from public.test_attempts where id = p_attempt for update;
  if not found or a.user_id <> auth.uid() then raise exception 'Attempt not found.'; end if;
  if a.submitted_at is null then
    select * into t from public.tests where id = a.test_id;
    -- answers sent after the end time (+2 min) are ignored → last autosave
    if p_answers is not null and (a.ends_at is null or now() <= a.ends_at + interval '2 minutes') then
      v_answers := public.clean_test_answers(a.test_id, p_answers);
      v_times := case when p_times is null then a.question_times else public.clean_test_times(a.test_id, p_times, t.duration_minutes * 60) end;
    else
      v_answers := a.answers;
      v_times := a.question_times;
    end if;
    perform public.finish_attempt(a.id, v_answers, v_times);
  end if;
  return public.attempt_report(a.id);
end;
$$;

-- The older one-step submit (used by old browser tabs) — same scoring + limits
create or replace function public.submit_test(p_test_id uuid, p_answers jsonb, p_started_at timestamptz default null, p_times jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare started jsonb; aid uuid;
begin
  started := public.start_test(p_test_id);
  aid := (started ->> 'attempt_id')::uuid;
  return public.submit_test_attempt(aid, p_answers, p_times)
         || jsonb_build_object('attempt_id', aid);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Report with negative marking (replaces the version in test-analytics.sql)
-- ---------------------------------------------------------------------
create or replace function public.attempt_report(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  a public.test_attempts; t public.tests;
  q_list jsonb; subjects jsonb; n_correct integer; n_wrong integer; n_skipped integer; v_total integer;
begin
  select * into a from public.test_attempts where id = p_attempt;
  if not found or not (a.user_id = auth.uid() or public.is_admin()) then raise exception 'Attempt not found.'; end if;
  if a.submitted_at is null then raise exception 'This attempt is not finished yet.'; end if;
  select * into t from public.tests where id = a.test_id;

  with r as (
    select q.*, case when jsonb_typeof(a.answers -> q.id::text) = 'number' then (a.answers ->> q.id::text)::int end as your_answer,
           case when jsonb_typeof(a.question_times -> q.id::text) = 'number' then round((a.question_times ->> q.id::text)::numeric)::int end as seconds
      from public.questions q where q.test_id = a.test_id
  ), r2 as (
    select *, case when your_answer is null then 'skipped' when your_answer = correct_option then 'correct' else 'wrong' end as result from r
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'question_id', id, 'question', question, 'options', options, 'your_answer', your_answer, 'correct_option', correct_option,
           'explanation', explanation, 'marks', marks, 'subject', subject, 'topic', topic, 'image_url', image_url, 'seconds', seconds,
           'result', result, 'marked', a.marked ? id::text) order by sort_order, created_at), '[]'::jsonb),
         count(*) filter (where result = 'correct'), count(*) filter (where result = 'wrong'), count(*) filter (where result = 'skipped'),
         coalesce(sum(marks), 0)
    into q_list, n_correct, n_wrong, n_skipped, v_total
    from r2;

  with q as (
    select coalesce(q.subject, 'General') as subject, q.marks, q.correct_option,
           case when jsonb_typeof(a.answers -> q.id::text) = 'number' then (a.answers ->> q.id::text)::int end as ans,
           case when jsonb_typeof(a.question_times -> q.id::text) = 'number' then (a.question_times ->> q.id::text)::numeric else 0 end as secs
      from public.questions q where q.test_id = a.test_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('subject', subject, 'score', score, 'total', total, 'correct', correct, 'wrong', wrong,
           'skipped', skipped, 'percent', case when total > 0 then greatest(0, round(score * 100.0 / total)) else 0 end, 'seconds', round(secs))
           order by subject), '[]'::jsonb)
    into subjects
    from (select subject,
                 coalesce(sum(marks) filter (where ans = correct_option), 0) - t.negative_marks * count(*) filter (where ans is not null and ans <> correct_option) as score,
                 sum(marks) as total, count(*) filter (where ans = correct_option) as correct,
                 count(*) filter (where ans is not null and ans <> correct_option) as wrong, count(*) filter (where ans is null) as skipped,
                 sum(secs) as secs
            from q group by subject) s;

  return jsonb_build_object(
    'attempt_id', a.id, 'test_id', t.id, 'test_title', t.title, 'test_type', t.type, 'duration_minutes', t.duration_minutes,
    'score', a.score, 'total_marks', v_total, 'correct', n_correct, 'wrong', n_wrong, 'skipped', n_skipped,
    'accuracy', case when n_correct + n_wrong > 0 then round(n_correct * 100.0 / (n_correct + n_wrong)) else 0 end,
    'marks_per_correct', t.marks_per_correct, 'negative_marks', t.negative_marks,
    'negative_total', t.negative_marks * n_wrong,
    'time_taken_seconds', coalesce(a.time_taken_seconds, greatest(0, extract(epoch from (a.submitted_at - a.started_at))::int)),
    'submitted_at', a.submitted_at, 'subjects', subjects, 'questions', q_list,
    'max_attempts', t.max_attempts,
    'attempts_used', (select count(*) from public.test_attempts where user_id = a.user_id and test_id = t.id)
  );
end;
$$;

revoke all on function public.clean_test_answers(uuid, jsonb), public.clean_test_marked(uuid, jsonb), public.clean_test_times(uuid, jsonb, integer),
                       public.score_test_answers(uuid, jsonb), public.finish_attempt(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.start_test(uuid), public.test_overview(uuid), public.save_test_progress(uuid, jsonb, jsonb, jsonb),
                       public.submit_test_attempt(uuid, jsonb, jsonb), public.finalize_my_expired_attempts() from public, anon;
grant execute on function public.start_test(uuid), public.test_overview(uuid), public.save_test_progress(uuid, jsonb, jsonb, jsonb),
                       public.submit_test_attempt(uuid, jsonb, jsonb), public.finalize_my_expired_attempts() to authenticated;
revoke all on function public.submit_test(uuid, jsonb, timestamptz, jsonb) from public;
grant execute on function public.submit_test(uuid, jsonb, timestamptz, jsonb) to anon, authenticated;
revoke all on function public.attempt_report(uuid) from public, anon;
grant execute on function public.attempt_report(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. ⚠️ SAMPLE test (5 questions) for trying everything out — free,
--    clearly labelled. Delete it in Admin → Tests when you're done.
-- ---------------------------------------------------------------------
do $$
declare t uuid;
begin
  if not exists (select 1 from public.tests where is_sample) then
    insert into public.tests (title, type, duration_minutes, is_free, is_active, subjects, marks_per_correct, negative_marks, max_attempts, instructions, is_sample)
    values ('SAMPLE Test — for trying the test system (5 questions)', 'mock', 10, true, true,
            array['Physics', 'Chemistry', 'Mathematics', 'English', 'Aptitude'], 4, 1, 3,
            'This is a SAMPLE test to try the test screen. +4 for each correct answer, −1 for each wrong answer, 0 if you leave it. You can mark questions for review and come back. Your answers are saved automatically.',
            true)
    returning id into t;
    insert into public.questions (test_id, question, options, correct_option, explanation, marks, subject, topic, sort_order) values
      (t, 'SAMPLE: What is the SI unit of force?', '["Joule", "Newton", "Watt", "Pascal"]', 1, 'Force is measured in newtons (N): 1 N = 1 kg·m/s².', 4, 'Physics', 'Units', 1),
      (t, 'SAMPLE: Which gas makes up most of the Earth''s atmosphere?', '["Oxygen", "Carbon dioxide", "Nitrogen", "Argon"]', 2, 'Nitrogen is about 78% of the air.', 4, 'Chemistry', 'Basics', 2),
      (t, 'SAMPLE: What is the derivative of x² ?', '["x", "2x", "x²", "2"]', 1, 'd/dx (xⁿ) = n·xⁿ⁻¹, so d/dx (x²) = 2x.', 4, 'Mathematics', 'Calculus', 3),
      (t, 'SAMPLE: Choose the word closest in meaning to "RAPID".', '["Slow", "Quick", "Calm", "Heavy"]', 1, '"Rapid" means fast or quick.', 4, 'English', 'Vocabulary', 4),
      (t, 'SAMPLE: What comes next: 2, 4, 8, 16, …?', '["18", "24", "32", "20"]', 2, 'Each number doubles: 16 × 2 = 32.', 4, 'Aptitude', 'Series', 5);
  end if;
end $$;
