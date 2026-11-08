-- =====================================================================
--  MAINTENANCE MODE (Admin → Settings → Maintenance mode)
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  One settings row: on/off + the message visitors see. Everyone can READ
--  it (the website checks it before every page); only admins can change it.
--  Starts OFF.
-- =====================================================================
create table if not exists public.maintenance_settings (
  id          integer primary key default 1 check (id = 1),
  enabled     boolean not null default false,
  message     text not null default 'We''re updating EDUVORA to serve you better. We''ll be back shortly!'
              check (char_length(btrim(message)) between 1 and 500),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);
insert into public.maintenance_settings (id) values (1) on conflict (id) do nothing;

alter table public.maintenance_settings enable row level security;
drop policy if exists "maintenance: anyone reads"   on public.maintenance_settings;
drop policy if exists "maintenance: admin updates"  on public.maintenance_settings;
create policy "maintenance: anyone reads" on public.maintenance_settings
  for select to anon, authenticated using (true);
create policy "maintenance: admin updates" on public.maintenance_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.maintenance_settings from anon, authenticated;
revoke update on public.maintenance_settings from anon;

create or replace function public.before_maintenance_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.id := 1;
  new.message := btrim(new.message);
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
drop trigger if exists before_maintenance_update on public.maintenance_settings;
create trigger before_maintenance_update before update on public.maintenance_settings
  for each row execute function public.before_maintenance_update();

-- (Switching it on/off is recorded in Admin → Activity Log by the website.)
