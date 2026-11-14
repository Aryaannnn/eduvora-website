-- =====================================================================
--  INVOICES — locked copies + private "assets" bucket for the signature
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs payments.sql and privacy.sql, which you have already run.)
--
--  1. invoices: the FIRST time an invoice is made, the website saves a copy
--     of everything printed on it (name, item, amounts, GST, payment IDs…).
--     Every later download/email uses that copy, so an invoice NEVER changes
--     — even if the student edits their name or a session is moved.
--     Nobody can edit or delete a copy (not even admins). Only when a
--     student's account is deleted, their name/email/phone are removed from
--     it (privacy law); amounts and numbers stay for tax records.
--  2. Invoice numbers (EDU-2026-0001 …) can never be changed once given.
--  3. Private bucket "assets": put signature.png there. It has NO public
--     link and no access rules, so only the website's server can read it.
-- =====================================================================

-- ---------- 1. locked invoice copies ----------
create table if not exists public.invoices (
  invoice_number text primary key,
  source_kind    text not null check (source_kind in ('purchase', 'booking')),
  source_id      uuid not null unique,
  user_id        uuid references auth.users (id) on delete set null,
  data           jsonb not null,
  created_at     timestamptz not null default now(),
  anonymised_at  timestamptz
);
create index if not exists invoices_user_idx on public.invoices (user_id);

-- No policies = students and admins can't read or write it directly;
-- only the website's server (service role) does, after its own checks.
alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;

create or replace function public.invoices_locked()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Invoices can never be deleted.';
  end if;
  if new.invoice_number = old.invoice_number and new.source_kind = old.source_kind
     and new.source_id = old.source_id and new.created_at = old.created_at
     and (
       -- the student's login was deleted → only the link to it is cleared
       (new.data = old.data and new.anonymised_at is not distinct from old.anonymised_at and new.user_id is null)
       -- account deletion (anonymise_invoice_copies below) removes personal details
       or coalesce(current_setting('eduvora.invoice_anonymise', true), '') = 'on'
     )
  then
    return new;
  end if;
  raise exception 'An invoice can never be changed after it is created.';
end;
$$;
drop trigger if exists invoices_locked on public.invoices;
create trigger invoices_locked before update or delete on public.invoices
  for each row execute function public.invoices_locked();

-- Account deleted (privacy.sql marks purchases/bookings anonymised) → remove the
-- student's name, email and phone from their invoice copies too.
create or replace function public.anonymise_invoice_copies()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.anonymised_at is not null and old.anonymised_at is null then
    perform set_config('eduvora.invoice_anonymise', 'on', true);
    update public.invoices
       set data = data || jsonb_build_object('name', 'Deleted user', 'email', '', 'phone', ''),
           anonymised_at = now()
     where source_id = new.id and anonymised_at is null;
    perform set_config('eduvora.invoice_anonymise', 'off', true);
  end if;
  return new;
end;
$$;
drop trigger if exists anonymise_invoice_copies on public.purchases;
create trigger anonymise_invoice_copies after update of anonymised_at on public.purchases
  for each row execute function public.anonymise_invoice_copies();
drop trigger if exists anonymise_invoice_copies on public.bookings;
create trigger anonymise_invoice_copies after update of anonymised_at on public.bookings
  for each row execute function public.anonymise_invoice_copies();

-- ---------- 2. invoice numbers never change ----------
create or replace function public.keep_invoice_number()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if old.invoice_number is not null and new.invoice_number is distinct from old.invoice_number then
    raise exception 'An invoice number can never be changed once it is given.';
  end if;
  return new;
end;
$$;
drop trigger if exists keep_invoice_number on public.purchases;
create trigger keep_invoice_number before update of invoice_number on public.purchases
  for each row execute function public.keep_invoice_number();
drop trigger if exists keep_invoice_number on public.bookings;
create trigger keep_invoice_number before update of invoice_number on public.bookings
  for each row execute function public.keep_invoice_number();

-- ---------- 3. private bucket for the signature ----------
-- public = false → no public link. No storage policies are added for it, so
-- students, visitors and even logged-in admins in the browser can't read it.
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do update set public = false;
