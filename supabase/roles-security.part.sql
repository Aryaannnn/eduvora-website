-- ---------------------------------------------------------------------
-- ROLE SECURITY — roles change ONLY through the website's server
-- ---------------------------------------------------------------------
-- 1. Nobody can change a role through the database API — not students,
--    not counsellors, not even admins in the browser. Only the website's
--    server (service role), after checking that the person is an admin,
--    via change_user_role() below. (Supabase dashboard / SQL editor too.)
create or replace function public.protect_profile_role()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.jwt() ->> 'role', '') not in ('service_role', '') then
    raise exception 'Roles can only be changed by an admin in Admin → Students.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- 2. There must always be at least one admin
create or replace function public.keep_one_admin()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role is distinct from 'admin')
     and not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
    raise exception 'This is the last admin — make someone else an admin first.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists keep_one_admin on public.profiles;
create trigger keep_one_admin
  before update of role or delete on public.profiles
  for each row execute function public.keep_one_admin();

-- 3. The one way to change a role (called by the website's server only)
--    Safety rules: valid role · an admin can't change their own role ·
--    the last admin can't be changed · making an admin needs their email
--    typed exactly · every change goes to Admin → Activity Log.
create or replace function public.change_user_role(p_user uuid, p_new_role text, p_actor uuid, p_confirm_email text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  actor public.profiles;
  target public.profiles;
  old_role text;
begin
  if p_new_role not in ('student', 'parent', 'counsellor', 'admin') then raise exception 'Unknown role.'; end if;
  select * into actor from public.profiles where id = p_actor;
  if not found or actor.role <> 'admin' then raise exception 'Only admins can change roles.'; end if;
  if p_user = p_actor then raise exception 'You can''t change your own role (so you don''t lock yourself out).'; end if;

  -- lock all admins, so two changes at the same moment can't remove the last one
  perform 1 from public.profiles where role = 'admin' for update;
  select * into target from public.profiles where id = p_user for update;
  if not found then raise exception 'User not found.'; end if;
  old_role := target.role;
  if old_role = p_new_role then
    return jsonb_build_object('changed', false, 'old_role', old_role, 'new_role', p_new_role);
  end if;
  if p_new_role = 'admin' and lower(btrim(coalesce(p_confirm_email, ''))) is distinct from lower(btrim(coalesce(target.email, '')))
     then raise exception 'To make someone an admin, type their email address exactly.';
  end if;
  if old_role = 'admin' and not exists (select 1 from public.profiles where role = 'admin' and id <> target.id) then
    raise exception 'This is the last admin — make someone else an admin first.';
  end if;

  update public.profiles set role = p_new_role where id = target.id;

  -- Staff aren't leads; work assigned to someone who is no longer staff is un-assigned
  if p_new_role in ('admin', 'counsellor') and to_regclass('public.leads') is not null then
    execute 'delete from public.leads where user_id = $1' using target.id;
  end if;
  if p_new_role not in ('admin', 'counsellor') then
    if to_regclass('public.leads') is not null then execute 'update public.leads set assigned_to = null where assigned_to = $1' using target.id; end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'assigned_to') then
      execute 'update public.bookings set assigned_to = null where assigned_to = $1' using target.id;
    end if;
  end if;

  -- Activity Log (admin-security.sql)
  if to_regclass('public.admin_activity') is not null then
    insert into public.admin_activity (admin_id, admin_name, action, entity, entity_id, summary, details)
    values (actor.id, coalesce(nullif(actor.full_name, ''), actor.email, 'Admin'), 'user.role', 'profiles', target.id::text,
            left(format('Changed role of %s: %s → %s', coalesce(nullif(target.full_name, ''), target.email, 'user'), initcap(old_role), initcap(p_new_role)), 500),
            jsonb_build_object('user_email', target.email, 'old_role', old_role, 'new_role', p_new_role));
  end if;

  return jsonb_build_object('changed', true, 'old_role', old_role, 'new_role', p_new_role);
end;
$$;
revoke all on function public.change_user_role(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.change_user_role(uuid, text, uuid, text) to service_role;
