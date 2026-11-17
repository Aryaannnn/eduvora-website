-- =====================================================================
--  MOBILE NUMBER REQUIRED FOR STUDENTS (and parents)
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs setup.sql and privacy.sql.)
--
--  1. Every number is stored the same way: +91XXXXXXXXXX (10 digits starting
--     with 6, 7, 8 or 9). Spaces, dashes, a leading +91 / 91 / 0 are removed.
--  2. Existing numbers are converted. Numbers that aren't valid Indian mobile
--     numbers, and a number used by MORE THAN ONE account (the oldest account
--     keeps it), are cleared — those students are asked again on their next
--     login. Every cleared number is kept in profile_phone_fixes (admins only).
--  3. One number = one account (unique), checked by the database too.
--  4. New column profiles.class_year (Class 11 / Class 12 / Dropper / Parent / Other).
--  5. Sign-up saves the mobile number from the form (if it isn't used already).
--  Nothing is deleted.
-- =====================================================================

-- ---------- 1. one format ----------
create or replace function public.normalize_in_phone(p text)
returns text
language plpgsql immutable
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if length(d) = 12 and left(d, 2) = '91' then d := right(d, 10);
  elsif length(d) = 11 and left(d, 1) = '0' then d := right(d, 10);
  end if;
  if d ~ '^[6-9][0-9]{9}$' then return '+91' || d; end if;
  return null;
end;
$$;
grant execute on function public.normalize_in_phone(text) to anon, authenticated, service_role;

-- ---------- 4. class / year ----------
alter table public.profiles add column if not exists class_year text;
alter table public.profiles drop constraint if exists profiles_class_year_check;
alter table public.profiles add constraint profiles_class_year_check
  check (class_year is null or class_year in ('Class 11', 'Class 12', 'Dropper', 'Parent', 'Other'));

-- ---------- 2. convert existing numbers (record anything cleared) ----------
create table if not exists public.profile_phone_fixes (
  id         bigserial primary key,
  profile_id uuid not null,
  old_phone  text,
  reason     text not null,           -- 'invalid' or 'duplicate'
  fixed_at   timestamptz not null default now()
);
alter table public.profile_phone_fixes enable row level security;
drop policy if exists "phone fixes: admins read" on public.profile_phone_fixes;
create policy "phone fixes: admins read" on public.profile_phone_fixes for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.profile_phone_fixes from anon, authenticated;

drop trigger if exists profiles_phone_format on public.profiles;   -- (re-run: the trigger below is added again at the end)

-- invalid numbers → cleared (kept in the log)
with bad as (
  select id, phone from public.profiles
   where phone is not null and btrim(phone) <> '' and public.normalize_in_phone(phone) is null
)
insert into public.profile_phone_fixes (profile_id, old_phone, reason) select id, phone, 'invalid' from bad;
update public.profiles set phone = null
 where phone is not null and (btrim(phone) = '' or public.normalize_in_phone(phone) is null);

-- the same number on several accounts → the oldest account keeps it
with ranked as (
  select id, phone, row_number() over (partition by public.normalize_in_phone(phone) order by created_at, id) as n
    from public.profiles where phone is not null
)
insert into public.profile_phone_fixes (profile_id, old_phone, reason) select id, phone, 'duplicate' from ranked where n > 1;
with ranked as (
  select id, row_number() over (partition by public.normalize_in_phone(phone) order by created_at, id) as n
    from public.profiles where phone is not null
)
update public.profiles p set phone = null from ranked r where p.id = r.id and r.n > 1;

-- everything else → +91XXXXXXXXXX
update public.profiles set phone = public.normalize_in_phone(phone)
 where phone is not null and phone <> public.normalize_in_phone(phone);

-- ---------- 3. one number = one account; always the same format ----------
create unique index if not exists profiles_phone_uidx on public.profiles (phone) where phone is not null;

create or replace function public.profiles_phone_format()
returns trigger
language plpgsql
as $$
begin
  if new.phone is not null and btrim(new.phone) = '' then new.phone := null; end if;
  if new.phone is not null then
    new.phone := public.normalize_in_phone(new.phone);
    if new.phone is null then
      raise exception 'invalid_phone: Please enter a valid 10-digit mobile number.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_phone_format before insert or update of phone on public.profiles
  for each row execute function public.profiles_phone_format();

-- ---------- 5. sign-up: save the mobile number from the form ----------
-- (same as privacy.sql + the number; a number already used by another account
--  is not saved — the student is asked on their first login)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := lower(coalesce(new.raw_user_meta_data ->> 'role', 'student'));
  v_consent boolean := coalesce(new.raw_user_meta_data ->> 'privacy_consent', '') = 'true';
  v_phone text := public.normalize_in_phone(coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), new.phone));
begin
  -- Never trust the sign-up form for 'admin'
  if v_role not in ('student', 'parent') then
    v_role := 'student';
  end if;
  if v_phone is not null and exists (select 1 from public.profiles where phone = v_phone) then
    v_phone := null;
  end if;

  insert into public.profiles (id, full_name, email, phone, role, consent_at, consent_version)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    v_phone,
    v_role,
    case when v_consent then now() end,
    case when v_consent then left(new.raw_user_meta_data ->> 'consent_version', 40) end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- What changed (empty = nothing had to be cleared)
select f.reason, f.old_phone, p.full_name, p.email, f.fixed_at
  from public.profile_phone_fixes f left join public.profiles p on p.id = f.profile_id
 order by f.fixed_at desc, f.reason;
