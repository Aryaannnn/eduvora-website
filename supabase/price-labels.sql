-- =====================================================================
--  PRICE LABELS SWITCH (Admin → Settings → "Original price & % off")
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  One settings row: show or hide the crossed-out "original price" and the
--  "% off" badges on every product card, course page and package.
--  Everyone can READ it (the website needs it); only admins can change it.
--  Starts ON (labels shown) — the same as before this file.
-- =====================================================================
create table if not exists public.display_settings (
  id                   integer primary key default 1 check (id = 1),
  show_original_price  boolean not null default true,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users (id) on delete set null
);
insert into public.display_settings (id) values (1) on conflict (id) do nothing;

alter table public.display_settings enable row level security;
drop policy if exists "display: anyone reads"  on public.display_settings;
drop policy if exists "display: admin updates" on public.display_settings;
create policy "display: anyone reads" on public.display_settings
  for select to anon, authenticated using (true);
create policy "display: admin updates" on public.display_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.display_settings from anon, authenticated;
revoke update on public.display_settings from anon;

create or replace function public.before_display_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.id := 1;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
drop trigger if exists before_display_update on public.display_settings;
create trigger before_display_update before update on public.display_settings
  for each row execute function public.before_display_update();

-- (Changes are recorded in Admin → Activity Log by the website.)
