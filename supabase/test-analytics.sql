-- =====================================================================
--  TEST ANALYTICS (mock tests + MCQ tests)
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Run after setup.sql and free-resources.sql.)
--
--  1. questions.subject (Physics, Chemistry, Mathematics, Biology, English,
--     Aptitude) and questions.topic (optional)
--  2. test_attempts.time_taken_seconds + question_times (seconds per question)
--  3. submit_test()   — same server-side scoring as before, now also saves the
--                       times and returns the full report
--  4. attempt_report() — score, accuracy, time, subject-wise scores and the
--                       review (your answer / correct answer / explanation).
--                       Only for the student who took it (or an admin).
--  5. test_stats()    — admins: average score, average time and the
--                       most-missed questions for every test
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Subject + topic on questions
-- ---------------------------------------------------------------------
alter table public.questions add column if not exists subject text;
alter table public.questions add column if not exists topic   text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'questions_subject_check') then
    alter table public.questions add constraint questions_subject_check
      check (subject is null or subject in ('Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Aptitude'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'questions_topic_check') then
    alter table public.questions add constraint questions_topic_check
      check (topic is null or char_length(topic) <= 100);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Time on attempts
-- ---------------------------------------------------------------------
alter table public.test_attempts add column if not exists time_taken_seconds integer check (time_taken_seconds is null or time_taken_seconds >= 0);
alter table public.test_attempts add column if not exists question_times jsonb;   -- {"<question id>": seconds, …}
create index if not exists test_attempts_user_idx on public.test_attempts (user_id, submitted_at desc);
create index if not exists test_attempts_test_idx on public.test_attempts (test_id) where submitted_at is not null;

-- ---------------------------------------------------------------------
-- 3. The report for one attempt (owner or admin only)
-- ---------------------------------------------------------------------
create or replace function public.attempt_report(p_attempt uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  a public.test_attempts;
  t public.tests;
  q_list   jsonb;
  subjects jsonb;
  n_correct integer; n_wrong integer; n_skipped integer; v_total integer;
begin
  select * into a from public.test_attempts where id = p_attempt;
  if not found or not (a.user_id = auth.uid() or public.is_admin()) then
    raise exception 'Attempt not found.';
  end if;
  select * into t from public.tests where id = a.test_id;

  with q as (
    select q.id, q.question, q.options, q.correct_option, q.explanation, q.marks, q.subject, q.topic, q.sort_order, q.created_at,
           case when jsonb_typeof(a.answers -> q.id::text) = 'number' then (a.answers ->> q.id::text)::int end as your_answer,
           case when jsonb_typeof(a.question_times -> q.id::text) = 'number' then round((a.question_times ->> q.id::text)::numeric)::int end as seconds
      from public.questions q where q.test_id = a.test_id
  ), r as (
    select *, case when your_answer is null then 'skipped' when your_answer = correct_option then 'correct' else 'wrong' end as result from q
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'question_id', id, 'question', question, 'options', options, 'your_answer', your_answer,
      'correct_option', correct_option, 'explanation', explanation, 'marks', marks,
      'subject', subject, 'topic', topic, 'seconds', seconds, 'result', result
    ) order by sort_order, created_at), '[]'::jsonb),
    count(*) filter (where result = 'correct'),
    count(*) filter (where result = 'wrong'),
    count(*) filter (where result = 'skipped'),
    coalesce(sum(marks), 0)
  into q_list, n_correct, n_wrong, n_skipped, v_total
  from r;

  with q as (
    select coalesce(q.subject, 'General') as subject, q.marks, q.correct_option,
           case when jsonb_typeof(a.answers -> q.id::text) = 'number' then (a.answers ->> q.id::text)::int end as your_answer,
           case when jsonb_typeof(a.question_times -> q.id::text) = 'number' then (a.question_times ->> q.id::text)::numeric else 0 end as seconds
      from public.questions q where q.test_id = a.test_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'subject', subject, 'score', score, 'total', total, 'correct', correct, 'wrong', wrong, 'skipped', skipped,
           'percent', case when total > 0 then round(score * 100.0 / total) else 0 end, 'seconds', round(seconds)
         ) order by subject), '[]'::jsonb)
    into subjects
    from (
      select subject,
             coalesce(sum(marks) filter (where your_answer = correct_option), 0) as score,
             sum(marks) as total,
             count(*) filter (where your_answer = correct_option) as correct,
             count(*) filter (where your_answer is not null and your_answer <> correct_option) as wrong,
             count(*) filter (where your_answer is null) as skipped,
             sum(seconds) as seconds
        from q group by subject
    ) s;

  return jsonb_build_object(
    'attempt_id', a.id,
    'test_id', t.id,
    'test_title', t.title,
    'test_type', t.type,
    'duration_minutes', t.duration_minutes,
    'score', a.score,
    'total_marks', v_total,
    'correct', n_correct,
    'wrong', n_wrong,
    'skipped', n_skipped,
    'accuracy', case when n_correct + n_wrong > 0 then round(n_correct * 100.0 / (n_correct + n_wrong)) else 0 end,
    'time_taken_seconds', coalesce(a.time_taken_seconds, greatest(0, extract(epoch from (a.submitted_at - a.started_at))::int)),
    'submitted_at', a.submitted_at,
    'subjects', subjects,
    'questions', q_list
  );
end;
$$;
revoke all on function public.attempt_report(uuid) from public, anon;
grant execute on function public.attempt_report(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Submit: scored on the server (as before) + time, then the report
-- ---------------------------------------------------------------------
drop function if exists public.submit_test(uuid, jsonb, timestamptz);
create or replace function public.submit_test(p_test_id uuid, p_answers jsonb, p_started_at timestamptz default null, p_times jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  t          public.tests;
  v_answers  jsonb := coalesce(p_answers, '{}'::jsonb);
  v_times    jsonb := '{}'::jsonb;
  v_score    integer;
  v_total    integer;
  v_results  jsonb;
  v_attempt  uuid;
  v_started  timestamptz;
  v_report   jsonb;
begin
  t := public.assert_can_attempt(p_test_id);
  if jsonb_typeof(v_answers) <> 'object' then
    raise exception 'Answers must be an object.';
  end if;

  select
    coalesce(sum(q.marks) filter (where (v_answers ->> q.id::text) = q.correct_option::text), 0),
    coalesce(sum(q.marks), 0),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'question_id', q.id,
        'your_answer', v_answers -> q.id::text,
        'correct_option', q.correct_option,
        'explanation', q.explanation,
        'marks', q.marks
      ) order by q.sort_order, q.created_at), '[]'::jsonb)
  into v_score, v_total, v_results
  from public.questions q
  where q.test_id = t.id;

  -- Seconds per question (only this test's questions, 0 … test length)
  if jsonb_typeof(p_times) = 'object' then
    select coalesce(jsonb_object_agg(q.id::text,
             least(greatest(round((p_times ->> q.id::text)::numeric), 0), t.duration_minutes * 60)), '{}'::jsonb)
      into v_times
      from public.questions q
     where q.test_id = t.id and jsonb_typeof(p_times -> q.id::text) = 'number';
  end if;
  -- Start time can't be in the future or (much) longer ago than the test length
  v_started := greatest(least(coalesce(p_started_at, now()), now()), now() - make_interval(mins => t.duration_minutes + 10));

  if auth.uid() is not null then
    insert into public.test_attempts (user_id, test_id, answers, score, started_at, submitted_at, time_taken_seconds, question_times)
    values (auth.uid(), t.id, v_answers, v_score, v_started, now(),
            greatest(0, extract(epoch from (now() - v_started))::int), v_times)
    returning id into v_attempt;
    v_report := public.attempt_report(v_attempt);
  end if;

  return coalesce(v_report, '{}'::jsonb) || jsonb_build_object(
    'attempt_id', v_attempt,
    'score', v_score,
    'total_marks', v_total,
    'results', v_results
  );
end;
$$;
revoke all on function public.submit_test(uuid, jsonb, timestamptz, jsonb) from public;
grant execute on function public.submit_test(uuid, jsonb, timestamptz, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Admins: average score / time and most-missed questions per test
-- ---------------------------------------------------------------------
create or replace function public.test_stats()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Only admins can see test statistics.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'test_id', t.id,
      'attempts', st.attempts,
      'students', st.students,
      'avg_score', st.avg_score,
      'avg_percent', case when t.total_marks > 0 then round(st.avg_score * 100.0 / t.total_marks) else 0 end,
      'avg_seconds', st.avg_seconds,
      'missed', coalesce((
        select jsonb_agg(m order by (m ->> 'wrong_percent')::int desc, (m ->> 'question')) from (
          select jsonb_build_object(
                   'question_id', q.id, 'question', left(q.question, 200), 'subject', q.subject, 'topic', q.topic,
                   'wrong', count(*) filter (where (a.answers ->> q.id::text) is distinct from q.correct_option::text),
                   'skipped', count(*) filter (where a.answers -> q.id::text is null),
                   'wrong_percent', round(100.0 * count(*) filter (where (a.answers ->> q.id::text) is distinct from q.correct_option::text) / count(*))
                 ) as m
            from public.questions q
            join public.test_attempts a on a.test_id = q.test_id and a.submitted_at is not null
           where q.test_id = t.id
           group by q.id
        ) x
        where (m ->> 'wrong')::int > 0
      ), '[]'::jsonb)
    ))
    from public.tests t
    join lateral (
      select count(*) as attempts, count(distinct user_id) as students,
             round(avg(score), 1) as avg_score,
             round(avg(coalesce(time_taken_seconds, extract(epoch from (submitted_at - started_at))))) as avg_seconds
        from public.test_attempts where test_id = t.id and submitted_at is not null
    ) st on st.attempts > 0
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.test_stats() from public, anon;
grant execute on function public.test_stats() to authenticated;

-- ---------------------------------------------------------------------
-- 6. My Progress: every attempt of the logged-in student, with
--    subject-wise percentages (for the trend charts)
-- ---------------------------------------------------------------------
create or replace function public.my_progress()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.submitted_at), '[]'::jsonb)
    from (
      select a.id as attempt_id, a.test_id, t.title as test_title, t.type as test_type, a.score, a.submitted_at,
             coalesce(a.time_taken_seconds, greatest(0, extract(epoch from (a.submitted_at - a.started_at))::int)) as time_taken_seconds,
             (select coalesce(sum(q.marks), 0) from public.questions q where q.test_id = a.test_id) as total_marks,
             (select coalesce(jsonb_agg(jsonb_build_object('subject', s.subject, 'score', s.score, 'total', s.total,
                                        'percent', case when s.total > 0 then round(s.score * 100.0 / s.total) else 0 end)), '[]'::jsonb)
                from (select q.subject,
                             coalesce(sum(q.marks) filter (where (a.answers ->> q.id::text) = q.correct_option::text), 0) as score,
                             sum(q.marks) as total
                        from public.questions q
                       where q.test_id = a.test_id and q.subject is not null
                       group by q.subject) s) as subjects
        from public.test_attempts a
        join public.tests t on t.id = a.test_id
       where a.user_id = auth.uid() and a.submitted_at is not null
       order by a.submitted_at desc
       limit 200
    ) x;
$$;
revoke all on function public.my_progress() from public, anon;
grant execute on function public.my_progress() to authenticated;
