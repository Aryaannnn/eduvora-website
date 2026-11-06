-- =====================================================================
--  EDUVORA — EDITABLE STATS + REAL STUDENT REVIEWS
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE
--  file → click "Run". Run it AFTER setup.sql and payments.sql. Safe to run again.
--
--  1. site_stats: the "Our results" numbers — edit them in Admin → Settings.
--     A stat with an EMPTY number is hidden on the website.
--  2. Deletes all SAMPLE reviews.
--  3. Students who have PAID for something can write ONE review (with
--     consent). It stays hidden until you approve it in Admin → Reviews.
--     Their review gets a "Verified Student" badge.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Stats
-- ---------------------------------------------------------------------
create table if not exists public.site_stats (
  id          uuid primary key default gen_random_uuid(),
  label       text not null check (char_length(trim(label)) between 1 and 60),
  value       integer check (value is null or value >= 0),   -- empty = hidden
  suffix      text not null default '' check (char_length(suffix) <= 5),  -- e.g. "+" or "%"
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now()
);
alter table public.site_stats enable row level security;
drop policy if exists "site_stats: anyone reads" on public.site_stats;
drop policy if exists "site_stats: admin writes" on public.site_stats;
create policy "site_stats: anyone reads" on public.site_stats for select to anon, authenticated using (true);
create policy "site_stats: admin writes" on public.site_stats for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Starting values (only once). The two you haven't confirmed are left EMPTY (= hidden).
insert into public.site_stats (label, value, suffix, sort_order)
select * from (values
  ('Students guided',      1000, '+', 0),
  ('VIT selections',       null, '+', 1),
  ('Years of counselling', 2,    '+', 2),
  ('Parents satisfied',    null, '%', 3)
) as v (label, value, suffix, sort_order)
where not exists (select 1 from public.site_stats);

-- ---------------------------------------------------------------------
-- 2. Reviews: new columns
-- ---------------------------------------------------------------------
alter table public.reviews add column if not exists user_id       uuid references auth.users (id) on delete set null;
alter table public.reviews add column if not exists is_verified   boolean not null default false; -- written by a paid student
alter table public.reviews add column if not exists consent_given boolean not null default false;
alter table public.reviews add column if not exists consent_at    timestamptz;
alter table public.reviews add column if not exists updated_at    timestamptz not null default now();
create unique index if not exists reviews_one_per_student on public.reviews (user_id) where user_id is not null;

-- Has this person paid for anything? (a product, or a counselling session)
create or replace function public.has_paid_anything(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    exists (select 1 from public.purchases where user_id = p_user and status = 'paid' and amount > 0)
    or exists (select 1 from public.bookings where user_id = p_user and payment_status = 'paid')
  );
$$;
revoke all on function public.has_paid_anything(uuid) from public, anon;
grant execute on function public.has_paid_anything(uuid) to authenticated, service_role;

-- Students can't approve their own review or fake the "Verified" badge
create or replace function public.before_review_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if not new.consent_given then
      raise exception 'Please tick the consent box to submit your review.';
    end if;
    new.user_id     := auth.uid();
    new.is_approved := false;                              -- always waits for the admin
    new.is_verified := public.has_paid_anything(auth.uid());
    new.photo_url   := null;
    new.consent_at  := coalesce(new.consent_at, now());
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists before_review_write on public.reviews;
create trigger before_review_write before insert or update on public.reviews
  for each row execute function public.before_review_write();

-- ---------------------------------------------------------------------
-- 3. Reviews: security
-- ---------------------------------------------------------------------
drop policy if exists "reviews: anyone reads approved" on public.reviews;
drop policy if exists "reviews: read own"               on public.reviews;
drop policy if exists "reviews: paid student writes"    on public.reviews;
drop policy if exists "reviews: student edits own"      on public.reviews;
drop policy if exists "reviews: student deletes own"    on public.reviews;

create policy "reviews: anyone reads approved" on public.reviews
  for select to anon, authenticated using (is_approved or public.is_admin());  -- admins also see waiting ones
create policy "reviews: read own" on public.reviews
  for select to authenticated using (user_id = auth.uid());
create policy "reviews: paid student writes" on public.reviews
  for insert to authenticated with check (user_id = auth.uid() and consent_given and public.has_paid_anything(auth.uid()));
create policy "reviews: student edits own" on public.reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and consent_given);
create policy "reviews: student deletes own" on public.reviews
  for delete to authenticated using (user_id = auth.uid());
-- (admin insert / update / delete policies from setup.sql stay as they are)

-- Visitors don't need to see who wrote a review (only the name shown)
revoke select on public.reviews from anon;
grant select (id, name, type, rating, comment, photo_url, is_approved, is_verified, created_at) on public.reviews to anon;

-- ---------------------------------------------------------------------
-- 4. Delete all SAMPLE reviews
-- ---------------------------------------------------------------------
delete from public.reviews where comment like 'SAMPLE REVIEW%' or name like 'Sample %';
