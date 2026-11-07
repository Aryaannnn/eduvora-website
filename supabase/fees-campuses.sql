-- =====================================================================
--  FEES & CAMPUSES — Fee Calculator + Campus Comparison (/fee-calculator)
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  Edit everything later in Admin → Settings → Fees & Campuses.
--
--  ⚠️ The rows added at the bottom are SAMPLE DATA (is_sample = true).
--     They are NOT real VIT fees. Replace them with the official figures
--     before going live (Admin → Settings → Fees & Campuses →
--     "Delete all sample data"). The website shows a big SAMPLE label
--     while any sample row is used.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Campuses (details for the comparison table)
-- ---------------------------------------------------------------------
create table if not exists public.campuses (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique check (char_length(btrim(name)) between 2 and 60),
  location        text check (location is null or char_length(location) <= 120),
  branches        text[] not null default '{}',
  hostel_fee_min  integer check (hostel_fee_min is null or hostel_fee_min >= 0),
  hostel_fee_max  integer check (hostel_fee_max is null or hostel_fee_max >= 0),
  notes           text check (notes is null or char_length(notes) <= 1500),
  website         text check (website is null or website ~ '^https://'),
  sort_order      integer not null default 0,
  is_sample       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint campuses_hostel_order check (hostel_fee_min is null or hostel_fee_max is null or hostel_fee_max >= hostel_fee_min)
);

-- ---------------------------------------------------------------------
-- 2. Fees: year × campus × fee category → rank range + yearly tuition
-- ---------------------------------------------------------------------
create table if not exists public.campus_fees (
  id                uuid primary key default gen_random_uuid(),
  year              integer not null check (year between 2000 and 2100),
  campus            text not null references public.campuses (name) on update cascade on delete cascade,
  fee_category      smallint not null check (fee_category between 1 and 5),
  rank_from         integer not null check (rank_from >= 1),       -- best rank in this category
  rank_to           integer check (rank_to is null or rank_to >= rank_from), -- worst rank (empty = and above)
  tuition_per_year  integer not null check (tuition_per_year >= 0), -- ₹ per year
  notes             text check (notes is null or char_length(notes) <= 500),
  is_sample         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint campus_fees_unique unique (year, campus, fee_category)
);
create index if not exists campus_fees_lookup_idx on public.campus_fees (year, campus, rank_from);

-- ---------------------------------------------------------------------
-- 3. Security: everyone can read (it's a public page); only admins edit
-- ---------------------------------------------------------------------
alter table public.campuses    enable row level security;
alter table public.campus_fees enable row level security;

drop policy if exists "campuses: anyone reads" on public.campuses;
drop policy if exists "campuses: admin all"    on public.campuses;
drop policy if exists "fees: anyone reads"     on public.campus_fees;
drop policy if exists "fees: admin all"        on public.campus_fees;
create policy "campuses: anyone reads" on public.campuses for select to anon, authenticated using (true);
create policy "campuses: admin all" on public.campuses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "fees: anyone reads" on public.campus_fees for select to anon, authenticated using (true);
create policy "fees: admin all" on public.campus_fees for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete on public.campuses, public.campus_fees from anon;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists touch_campuses on public.campuses;
create trigger touch_campuses before update on public.campuses for each row execute function public.touch_updated_at();
drop trigger if exists touch_campus_fees on public.campus_fees;
create trigger touch_campus_fees before update on public.campus_fees for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. ⚠️ SAMPLE DATA — NOT REAL VIT FEES. Only added when the tables are empty.
-- ---------------------------------------------------------------------
insert into public.campuses (name, location, branches, hostel_fee_min, hostel_fee_max, notes, sort_order, is_sample)
select * from (values
  ('VIT Vellore', 'SAMPLE location — edit me', array['SAMPLE Branch A', 'SAMPLE Branch B', 'SAMPLE Branch C'], 100000, 200000, 'SAMPLE DATA — not real. Replace with official campus details.', 1, true),
  ('VIT Chennai', 'SAMPLE location — edit me', array['SAMPLE Branch A', 'SAMPLE Branch B'], 100000, 200000, 'SAMPLE DATA — not real. Replace with official campus details.', 2, true),
  ('VIT-AP',      'SAMPLE location — edit me', array['SAMPLE Branch A', 'SAMPLE Branch C'], 100000, 200000, 'SAMPLE DATA — not real. Replace with official campus details.', 3, true),
  ('VIT Bhopal',  'SAMPLE location — edit me', array['SAMPLE Branch B', 'SAMPLE Branch C'], 100000, 200000, 'SAMPLE DATA — not real. Replace with official campus details.', 4, true)
) v (name, location, branches, hostel_fee_min, hostel_fee_max, notes, sort_order, is_sample)
where not exists (select 1 from public.campuses);

-- Same made-up bands and round made-up amounts for every campus
insert into public.campus_fees (year, campus, fee_category, rank_from, rank_to, tuition_per_year, notes, is_sample)
select 2026, c.name, b.cat, b.rfrom, b.rto, b.fee, 'SAMPLE — not a real fee', true
from public.campuses c
cross join (values
  (1, 1, 10000, 100000),
  (2, 10001, 20000, 200000),
  (3, 20001, 40000, 300000),
  (4, 40001, 70000, 400000),
  (5, 70001, null::integer, 500000)
) b (cat, rfrom, rto, fee)
where c.is_sample
  and not exists (select 1 from public.campus_fees)
on conflict (year, campus, fee_category) do nothing;
