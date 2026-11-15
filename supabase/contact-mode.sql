-- =====================================================================
--  CONTACT MODE (Admin → Settings → Contact mode)
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs setup.sql for is_admin().)
--
--  One settings row:
--   mode = 'open'    → your number is shown to everyone with Call + WhatsApp
--          'private' → only paid students and admins see it (Help page,
--                      booking confirmation, payment success); everyone else
--                      gets the free enquiry form
--   open_note    → text shown in Open mode (contact page, footer)
--   private_note → text shown with the enquiry form in Private mode
--  Only the MODE and the TEXTS live here — the number itself stays in
--  CONTACT_PHONE on the server (Vercel), never in the database.
--  Everyone can read this row (pages need it); only admins can change it.
--  Until this file is run, the website uses Open mode.
-- =====================================================================
create table if not exists public.contact_settings (
  id            integer primary key default 1 check (id = 1),
  mode          text not null default 'open' check (mode in ('open', 'private')),
  open_note     text not null default 'WhatsApp us anytime – replies 10 AM to 8 PM, Mon to Sat. Counselling calls are for booked students.'
                check (char_length(btrim(open_note)) between 1 and 300),
  private_note  text not null default 'We''ll call you back within a few hours.'
                check (char_length(btrim(private_note)) between 1 and 300),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null
);
insert into public.contact_settings (id) values (1) on conflict (id) do nothing;

alter table public.contact_settings enable row level security;
drop policy if exists "contact settings: anyone reads"  on public.contact_settings;
drop policy if exists "contact settings: admin updates" on public.contact_settings;
create policy "contact settings: anyone reads" on public.contact_settings
  for select to anon, authenticated using (true);
create policy "contact settings: admin updates" on public.contact_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.contact_settings from anon, authenticated;
revoke update on public.contact_settings from anon;

create or replace function public.before_contact_settings_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.id := 1;
  new.open_note := btrim(new.open_note);
  new.private_note := btrim(new.private_note);
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
drop trigger if exists before_contact_settings_update on public.contact_settings;
create trigger before_contact_settings_update before update on public.contact_settings
  for each row execute function public.before_contact_settings_update();
