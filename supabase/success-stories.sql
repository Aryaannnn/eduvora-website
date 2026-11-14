-- =====================================================================
--  SUCCESS STORIES — Admin → Success Stories
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  Real students only: name, year, what they achieved ("CSE, VIT Vellore"),
--  a short quote, optional photo and optional video link.
--  A story can ONLY be saved when you confirm the student's consent
--  (the database refuses it otherwise). If a student withdraws consent,
--  delete the story. Visitors see only published stories.
-- =====================================================================
create table if not exists public.success_stories (
  id                 uuid primary key default gen_random_uuid(),
  student_name       text not null check (char_length(btrim(student_name)) between 2 and 80),
  year               integer check (year is null or year between 2000 and 2100),
  achievement        text not null check (char_length(btrim(achievement)) between 2 and 120),   -- e.g. "CSE, VIT Vellore"
  quote              text not null check (char_length(btrim(quote)) between 10 and 400),
  photo_url          text check (photo_url is null or photo_url ~ '^https://'),
  video_url          text check (video_url is null or video_url ~ '^https://'),
  consent_confirmed  boolean not null default false check (consent_confirmed),               -- never without consent
  consent_at         timestamptz not null default now(),
  consent_by         uuid references auth.users (id) on delete set null,
  is_published       boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists success_stories_order_idx on public.success_stories (sort_order, created_at desc);

alter table public.success_stories enable row level security;
drop policy if exists "stories: anyone reads published" on public.success_stories;
drop policy if exists "stories: admin all"              on public.success_stories;
create policy "stories: anyone reads published" on public.success_stories
  for select to anon, authenticated using (is_published or public.is_admin());
create policy "stories: admin all" on public.success_stories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.success_stories from anon;

create or replace function public.before_story_write()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.student_name := btrim(new.student_name);
  new.achievement  := btrim(new.achievement);
  new.quote        := btrim(new.quote);
  new.updated_at   := now();
  if tg_op = 'INSERT' then
    new.consent_at := now();
    new.consent_by := coalesce(auth.uid(), new.consent_by);
  else
    new.consent_at := old.consent_at;   -- when consent was first confirmed never changes
    new.consent_by := old.consent_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists before_story_write on public.success_stories;
create trigger before_story_write before insert or update on public.success_stories
  for each row execute function public.before_story_write();
