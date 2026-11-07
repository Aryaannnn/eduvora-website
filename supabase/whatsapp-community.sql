-- =====================================================================
--  EDUVORA — WHATSAPP COMMUNITY LINK + CLICK COUNT
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE file
--  → Run. Safe to run again.
--
--  • The link is set in Admin → Settings (empty = the banner is hidden).
--  • Every click on a "Join" button is counted (Admin → Overview).
-- =====================================================================

create table if not exists public.community_settings (
  id             integer primary key default 1 check (id = 1),
  whatsapp_link  text check (whatsapp_link is null or whatsapp_link ~ '^https://(chat\.whatsapp\.com|(www\.)?whatsapp\.com/channel|wa\.me)/'),
  updated_at     timestamptz not null default now()
);
insert into public.community_settings (id) values (1) on conflict (id) do nothing;

alter table public.community_settings enable row level security;
drop policy if exists "community: anyone reads" on public.community_settings;
drop policy if exists "community: admin updates" on public.community_settings;
create policy "community: anyone reads" on public.community_settings for select to anon, authenticated using (true);
create policy "community: admin updates" on public.community_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- One row per click (written only by the server — /go/community)
create table if not exists public.community_clicks (
  id          bigint generated always as identity primary key,
  source      text not null default 'other' check (source in ('home', 'dates', 'dashboard', 'signup', 'email', 'other')),
  user_id     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists community_clicks_time_idx on public.community_clicks (created_at);

alter table public.community_clicks enable row level security;
drop policy if exists "community clicks: admin reads" on public.community_clicks;
create policy "community clicks: admin reads" on public.community_clicks for select to authenticated using (public.is_admin());
