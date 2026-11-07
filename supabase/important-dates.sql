-- =====================================================================
--  EDUVORA — IMPORTANT DATES & LATEST UPDATES
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE file
--  → Run. Safe to run again.
--
--  • important_dates: timeline events (applications, exam, results,
--    counselling phases, fee deadlines…). Status (Upcoming / Ongoing /
--    Completed) is worked out from the dates automatically.
--  • site_updates: short news posts for "Latest Updates".
--  Edit both in Admin → Important Dates. Only ONE clearly marked SAMPLE
--  event is added — no real dates. Always confirm dates on the official
--  VIT website before publishing.
-- =====================================================================

create table if not exists public.important_dates (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(title) between 2 and 150),
  category       text not null default 'other' check (category in ('application', 'exam', 'admit_card', 'result', 'counselling', 'fees', 'other')),
  start_date     date not null,
  end_date       date,                                   -- empty = a single day
  description    text check (description is null or char_length(description) <= 600),
  official_link  text check (official_link is null or official_link ~ '^https?://'),
  sort_order     integer not null default 0,
  is_published   boolean not null default true,
  is_sample      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists important_dates_order_idx on public.important_dates (sort_order, start_date);

create table if not exists public.site_updates (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 2 and 150),
  body          text check (body is null or char_length(body) <= 1000),
  link          text check (link is null or link ~ '^https?://'),
  is_pinned     boolean not null default false,
  is_published  boolean not null default true,
  published_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists site_updates_pub_idx on public.site_updates (is_pinned desc, published_at desc);

alter table public.important_dates enable row level security;
alter table public.site_updates    enable row level security;

drop policy if exists "dates: anyone reads published" on public.important_dates;
drop policy if exists "dates: admin all"              on public.important_dates;
drop policy if exists "updates: anyone reads published" on public.site_updates;
drop policy if exists "updates: admin all"              on public.site_updates;

create policy "dates: anyone reads published" on public.important_dates
  for select to anon, authenticated using (is_published or public.is_admin());
create policy "dates: admin all" on public.important_dates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "updates: anyone reads published" on public.site_updates
  for select to anon, authenticated using ((is_published and published_at <= now()) or public.is_admin());
create policy "updates: admin all" on public.site_updates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ONE sample event so you can see the design (delete it in the admin).
-- It is NOT a real date.
insert into public.important_dates (title, category, start_date, end_date, description, official_link, sort_order, is_sample)
select 'SAMPLE — Example event (not a real date)', 'other', current_date + 14, current_date + 16,
       'This is a SAMPLE to show the design. Delete it in Admin → Important Dates and add the real dates from the official VIT website.',
       'https://vit.ac.in', 0, true
where not exists (select 1 from public.important_dates where is_sample);
