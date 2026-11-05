-- =====================================================================
--  EDUVORA — VITEEE RANK & COLLEGE PREDICTOR
--
--  HOW TO USE: run supabase/setup.sql FIRST (once). Then:
--  Supabase → SQL Editor → New query → paste this WHOLE file → Run.
--  Safe to run again (it won't duplicate data).
--
--  ⚠️ The data added at the bottom is SAMPLE DATA (marked is_sample = true).
--     It is NOT real VITEEE data. Replace it with real data before going live
--     (Admin Panel → Predictor → "Delete all sample data", then upload your CSVs).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- Marks → rank bands. Marks are out of 125. Higher marks = better (smaller) rank.
-- Example row: 100–110 marks → rank 500 (at 110 marks) to 1,500 (at 100 marks)
create table if not exists public.rank_data (
  id          uuid primary key default gen_random_uuid(),
  year        integer not null check (year between 2000 and 2100),
  min_marks   numeric(5,2) not null check (min_marks between 0 and 125),
  max_marks   numeric(5,2) not null check (max_marks between 0 and 125),
  min_rank    integer not null check (min_rank >= 1),   -- best rank in this band (at max_marks)
  max_rank    integer not null check (max_rank >= 1),   -- worst rank in this band (at min_marks)
  is_sample   boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint rank_data_marks_order check (max_marks >= min_marks),
  constraint rank_data_rank_order  check (max_rank >= min_rank)
);

-- Closing ranks per campus + branch + fee category + counselling phase
create table if not exists public.college_cutoffs (
  id                 uuid primary key default gen_random_uuid(),
  year               integer not null check (year between 2000 and 2100),
  campus             text not null check (campus in ('VIT Vellore', 'VIT Chennai', 'VIT-AP', 'VIT Bhopal')),
  branch             text not null check (length(trim(branch)) > 0),
  fee_category       smallint not null check (fee_category between 1 and 5),
  counselling_phase  smallint not null default 1 check (counselling_phase between 1 and 10),
  closing_rank       integer not null check (closing_rank >= 1),
  is_sample          boolean not null default false,
  created_at         timestamptz not null default now(),
  constraint college_cutoffs_unique unique (year, campus, branch, fee_category, counselling_phase)
);

-- Every prediction a logged-in student makes (great for counselling follow-ups)
create table if not exists public.predictions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  marks               numeric(5,2) check (marks is null or marks between 0 and 125), -- empty if the student typed a rank
  entered_rank        integer check (entered_rank is null or entered_rank >= 1),     -- filled if the student typed a rank
  predicted_min_rank  integer not null check (predicted_min_rank >= 1),
  predicted_max_rank  integer not null check (predicted_max_rank >= predicted_min_rank),
  preferred_campus    text,
  preferred_branch    text,
  data_year           integer,
  created_at          timestamptz not null default now()
);

-- One single settings row (id is always 1)
create table if not exists public.predictor_settings (
  id               smallint primary key default 1 check (id = 1),
  active_year      integer not null,
  disclaimer_text  text not null,
  updated_at       timestamptz not null default now()
);

create index if not exists rank_data_year_idx        on public.rank_data (year, min_marks);
create index if not exists college_cutoffs_year_idx  on public.college_cutoffs (year, campus, branch);
create index if not exists predictions_user_idx      on public.predictions (user_id, created_at desc);
create index if not exists predictions_created_idx   on public.predictions (created_at desc);


-- ---------------------------------------------------------------------
-- 2. SECURITY (Row Level Security)
--    Only admins + the server read rank data and cutoffs (the predictor is
--    for paid counselling students — see predictor-access.sql). Settings are public.
--    Students see ONLY their own predictions. Only admins change data.
--    (public.is_admin() comes from setup.sql)
-- ---------------------------------------------------------------------
alter table public.rank_data          enable row level security;
alter table public.college_cutoffs    enable row level security;
alter table public.predictions        enable row level security;
alter table public.predictor_settings enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('rank_data', 'college_cutoffs', 'predictions', 'predictor_settings')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- rank_data
-- 🔒 Only admins (and the website server) can read the real rank data
create policy "rank_data: admin reads" on public.rank_data for select to authenticated using (public.is_admin());
create policy "rank_data: admin insert" on public.rank_data for insert to authenticated with check (public.is_admin());
create policy "rank_data: admin update" on public.rank_data for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "rank_data: admin delete" on public.rank_data for delete to authenticated using (public.is_admin());

-- college_cutoffs
create policy "cutoffs: admin reads" on public.college_cutoffs for select to authenticated using (public.is_admin());
create policy "cutoffs: admin insert" on public.college_cutoffs for insert to authenticated with check (public.is_admin());
create policy "cutoffs: admin update" on public.college_cutoffs for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "cutoffs: admin delete" on public.college_cutoffs for delete to authenticated using (public.is_admin());

-- predictor_settings
create policy "settings: anyone reads" on public.predictor_settings for select to anon, authenticated using (true);
create policy "settings: admin insert" on public.predictor_settings for insert to authenticated with check (public.is_admin());
create policy "settings: admin update" on public.predictor_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- predictions: a student reads ONLY their own; the server saves them (after
-- checking predictor access); admins read and delete all
create policy "predictions: read own or admin" on public.predictions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "predictions: admin delete" on public.predictions
  for delete to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------
-- 3. SETTINGS (created once — edit later in Admin Panel → Predictor)
-- ---------------------------------------------------------------------
insert into public.predictor_settings (id, active_year, disclaimer_text)
values (
  1,
  2026,
  'This is an estimate based on previous year data. Actual rank and admission may differ. The current figures are SAMPLE data for demonstration only.'
)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 4. ⚠️ SAMPLE DATA (year 2026) — NOT REAL VITEEE DATA. REPLACE BEFORE GOING LIVE.
-- ---------------------------------------------------------------------

-- Marks → rank bands (only added if there is no sample data yet)
insert into public.rank_data (year, min_marks, max_marks, min_rank, max_rank, is_sample)
select 2026, v.min_marks, v.max_marks, v.min_rank, v.max_rank, true
from (values
  (110, 125,     1,    500),
  (100, 110,   500,   1500),
  ( 90, 100,  1500,   4000),
  ( 80,  90,  4000,   8000),
  ( 70,  80,  8000,  15000),
  ( 60,  70, 15000,  25000),
  ( 50,  60, 25000,  40000),
  ( 40,  50, 40000,  60000),
  ( 30,  40, 60000,  85000),
  (  0,  30, 85000, 120000)
) as v (min_marks, max_marks, min_rank, max_rank)
where not exists (select 1 from public.rank_data where is_sample);

-- Closing ranks: 4 campuses × 6 branches × 5 fee categories (phase 1)
-- Made-up formula: branch base rank × campus factor × category factor
insert into public.college_cutoffs (year, campus, branch, fee_category, counselling_phase, closing_rank, is_sample)
select 2026, c.campus, b.branch, cat.n, 1,
       least(round(b.base * c.factor * cat.factor)::int, 120000), true
from (values ('VIT Vellore', 1.0), ('VIT Chennai', 1.6), ('VIT-AP', 3.0), ('VIT Bhopal', 3.5)) as c (campus, factor)
cross join (values
  ('CSE (Core)', 1500), ('CSE with AI & ML', 2500), ('CSE with Data Science', 3200),
  ('ECE', 6000), ('EEE', 10000), ('Mechanical', 20000)
) as b (branch, base)
cross join (values (1, 1.0), (2, 1.6), (3, 2.5), (4, 4.0), (5, 6.0)) as cat (n, factor)
on conflict (year, campus, branch, fee_category, counselling_phase) do nothing;

-- =====================================================================
-- DONE! 🎉  Open /predictor on your website to try it.
-- =====================================================================
