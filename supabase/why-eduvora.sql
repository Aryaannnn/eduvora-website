-- =====================================================================
--  "WHY EDUVORA?" CARDS (home page) — edited in Admin → Settings
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  One settings row: show/hide + up to 4 cards (icon, title, text, link).
--  Everyone can READ it (the home page shows it); only admins can change it.
--  Until this file is run, the home page shows the 4 default cards.
-- =====================================================================
create table if not exists public.why_settings (
  id          integer primary key default 1 check (id = 1),
  enabled     boolean not null default true,
  title       text not null default 'Why EDUVORA?' check (char_length(btrim(title)) between 1 and 80),
  cards       jsonb not null default '[
    {"icon":"graduation","title":"Guided by a current VIT student","text":"Utkarsh studies at VIT Vellore right now, so you get first-hand, up-to-date advice on campuses, branches, fees and hostel life.","href":"/founder"},
    {"icon":"users","title":"1,000+ students guided","text":"Over 2 years of helping VITEEE aspirants pick the right campus and branch with confidence.","href":"/reviews"},
    {"icon":"headset","title":"Personal 1-to-1 counselling","text":"A private video session about YOUR rank, budget and goals — not a crowded webinar.","href":"/book-a-slot"},
    {"icon":"target","title":"Rank & College Predictor","text":"See your likely VITEEE rank from your marks, and the campuses and branches within reach.","href":"/predictor"}
  ]'::jsonb
              check (jsonb_typeof(cards) = 'array' and jsonb_array_length(cards) <= 4),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);
insert into public.why_settings (id) values (1) on conflict (id) do nothing;

alter table public.why_settings enable row level security;
drop policy if exists "why: anyone reads"  on public.why_settings;
drop policy if exists "why: admin updates" on public.why_settings;
create policy "why: anyone reads" on public.why_settings
  for select to anon, authenticated using (true);
create policy "why: admin updates" on public.why_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.why_settings from anon, authenticated;
revoke update on public.why_settings from anon;

create or replace function public.before_why_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.id := 1;
  new.title := btrim(new.title);
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
drop trigger if exists before_why_update on public.why_settings;
create trigger before_why_update before update on public.why_settings
  for each row execute function public.before_why_update();

-- (Changes are recorded in Admin → Activity Log by the website.)
