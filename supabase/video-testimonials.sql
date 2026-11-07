-- =====================================================================
--  EDUVORA — VIDEO TESTIMONIALS
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE file
--  → Run. Safe to run again.
--
--  Admin → Reviews → "Video testimonials". Only videos where you confirmed
--  the student's CONSENT can be shown on the website.
-- =====================================================================

create table if not exists public.video_testimonials (
  id                 uuid primary key default gen_random_uuid(),
  youtube_id         text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),   -- e.g. dQw4w9WgXcQ
  student_name       text not null check (char_length(student_name) between 2 and 80),
  achievement        text check (achievement is null or char_length(achievement) <= 120),  -- e.g. "CSE, VIT Vellore"
  year               integer check (year is null or year between 2000 and 2100),
  consent_confirmed  boolean not null default false,
  consent_at         timestamptz,
  consent_by         uuid references auth.users (id) on delete set null,
  is_published       boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  -- a video can only be shown on the website when consent is confirmed
  check (not is_published or consent_confirmed)
);
create index if not exists video_testimonials_order_idx on public.video_testimonials (sort_order, created_at desc);

alter table public.video_testimonials enable row level security;
drop policy if exists "videos: anyone reads published" on public.video_testimonials;
drop policy if exists "videos: admin all"              on public.video_testimonials;
create policy "videos: anyone reads published" on public.video_testimonials
  for select to anon, authenticated using ((is_published and consent_confirmed) or public.is_admin());
create policy "videos: admin all" on public.video_testimonials
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
