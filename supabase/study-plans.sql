-- =====================================================================
--  DAY-WISE STUDY PLAN for the crash courses
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs product-files.sql and courses-question-bank.sql — can_access_product.)
--
--  • study_plan_days     — the plan (Admin → Products → course → Study plan):
--                          day number, subject(s), topics, linked PDFs, note
--  • study_plan_progress — "Mark day as done" (each student, own rows only)
--  • study_plan_starts   — the student's own start date (default: enrolment)
--  • Adds 2 clearly labelled SAMPLE days to each of the four crash courses
--    (only if the course has no days yet) — replace or delete them.
--  Students see a course's plan only if they can open the course.
-- =====================================================================

create table if not exists public.study_plan_days (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  day_number  integer not null check (day_number between 1 and 400),
  subjects    text[] not null default '{}',
  topics      text[] not null default '{}',
  file_ids    uuid[] not null default '{}',     -- linked PDFs of this course
  note        text check (note is null or char_length(note) <= 1000),
  is_sample   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists study_plan_days_product_idx on public.study_plan_days (product_id, day_number);

create table if not exists public.study_plan_progress (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day_id   uuid not null references public.study_plan_days (id) on delete cascade,
  done_at  timestamptz not null default now(),
  primary key (user_id, day_id)
);

create table if not exists public.study_plan_starts (
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  start_date  date not null,
  primary key (user_id, product_id)
);

-- ---------- who may see / change what ----------
alter table public.study_plan_days enable row level security;
drop policy if exists "plan days: course students and staff read" on public.study_plan_days;
create policy "plan days: course students and staff read" on public.study_plan_days
  for select to authenticated using (public.is_staff() or public.can_access_product(auth.uid(), product_id));
drop policy if exists "plan days: admins write" on public.study_plan_days;
create policy "plan days: admins write" on public.study_plan_days
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.study_plan_days from anon;

alter table public.study_plan_progress enable row level security;
drop policy if exists "plan progress: own" on public.study_plan_progress;
create policy "plan progress: own" on public.study_plan_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_access_product(auth.uid(), (select d.product_id from public.study_plan_days d where d.id = day_id)));
drop policy if exists "plan progress: staff read" on public.study_plan_progress;
create policy "plan progress: staff read" on public.study_plan_progress for select to authenticated using (public.is_staff());
revoke all on public.study_plan_progress from anon;

alter table public.study_plan_starts enable row level security;
drop policy if exists "plan start: own" on public.study_plan_starts;
create policy "plan start: own" on public.study_plan_starts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_access_product(auth.uid(), product_id));
revoke all on public.study_plan_starts from anon;

-- ---------- 2 SAMPLE days per crash course (only where there are no days yet) ----------
insert into public.study_plan_days (product_id, day_number, subjects, topics, note, is_sample)
select p.id, d.n, d.subjects, d.topics, d.note, true
  from public.products p
  cross join (values
    (1, array['Physics'], array['SAMPLE topic 1', 'SAMPLE topic 2'], 'SAMPLE day — replace this with your own plan in Admin → Products → Study plan.'),
    (2, array['Chemistry', 'Mathematics'], array['SAMPLE topic A', 'SAMPLE topic B'], 'SAMPLE day — replace or delete it.')
  ) as d (n, subjects, topics, note)
 where p.slug in ('viteee-60-day-crash-course', 'viteee-45-day-crash-course', 'viteee-30-day-crash-course', 'viteee-10-day-crash-course')
   and not exists (select 1 from public.study_plan_days x where x.product_id = p.id);
