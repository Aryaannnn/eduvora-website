-- =====================================================================
--  ACCESS PERIOD PER COURSE / PRODUCT
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  Run AFTER question-bank.sql (it replaces can_access_product with the same
--  rules + the access end).
--
--  • The product's setting (Admin → Products → "Access duration") lives in
--    products.details.access: { kind: lifetime | days | until, days, until, renewals }.
--  • Every paid purchase gets access_until (null = lifetime), set automatically
--    from the product when it is paid. Admins can extend it (Admin → Students).
--  • After access_until: the course stays in My Courses as "Access expired",
--    but PDFs, class links, progress and the study plan are closed — checked
--    by the database (can_access_product) on every request.
--  • EXISTING BUYERS: every product starts as "Lifetime", so nobody loses
--    access by running this. When you later set a duration on a product, its
--    existing buyers get it counted from THAT day (apply_product_access).
-- =====================================================================

alter table public.purchases add column if not exists access_until timestamptz;            -- null = lifetime
alter table public.purchases add column if not exists access_set_by text;                  -- 'auto' (from the product) / 'admin'
alter table public.purchases drop constraint if exists purchases_access_set_by_check;
alter table public.purchases add constraint purchases_access_set_by_check check (access_set_by is null or access_set_by in ('auto', 'admin'));
alter table public.purchases add column if not exists access_reminder_sent_at timestamptz;  -- "access ends in 7 days" email sent
create index if not exists purchases_access_until_idx on public.purchases (access_until) where access_until is not null;

-- ---------- when does access end for a product bought at p_from? (null = lifetime) ----------
create or replace function public.access_end_for(p_product uuid, p_from timestamptz)
returns timestamptz
language plpgsql stable security definer set search_path = public
as $$
declare
  a jsonb;
  k text;
begin
  select details -> 'access' into a from public.products where id = p_product;
  k := coalesce(a ->> 'kind', 'lifetime');
  if k = 'days' and coalesce((a ->> 'days')::int, 0) > 0 then
    return p_from + make_interval(days => (a ->> 'days')::int);
  elsif k = 'until' and (a ->> 'until') ~ '^\d{4}-\d{2}-\d{2}$' then
    return (((a ->> 'until')::date + 1)::timestamp at time zone 'Asia/Kolkata');   -- end of that day, India time
  end if;
  return null;
end;
$$;

-- a purchase becomes paid → its access end is set from the product
create or replace function public.purchases_set_access()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid')
     and new.access_until is null and coalesce(new.access_set_by, '') <> 'admin' then
    new.access_until := public.access_end_for(new.product_id, now());
    new.access_set_by := 'auto';
  end if;
  return new;
end;
$$;
drop trigger if exists purchases_set_access on public.purchases;
create trigger purchases_set_access before insert or update of status on public.purchases
  for each row execute function public.purchases_set_access();

-- ---------- "has a paid purchase whose access hasn't ended" ----------
create or replace function public.purchase_active(p_user uuid, p_product uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.purchases
     where user_id = p_user and product_id = p_product and status = 'paid'
       and (access_until is null or access_until > now())
  );
$$;
revoke all on function public.purchase_active(uuid, uuid) from public, anon;
grant execute on function public.purchase_active(uuid, uuid) to authenticated, service_role;

-- ---------- the one access rule (same as question-bank.sql + access end) ----------
create or replace function public.can_access_product(p_user uuid, p_product uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  p  public.products;
begin
  if p_user is null or p_product is null then return false; end if;
  if auth.uid() is not null and auth.uid() <> p_user and not public.is_admin() then return false; end if;
  if exists (select 1 from public.profiles where id = p_user and role = 'admin') then return true; end if;

  select * into p from public.products where id = p_product;
  if not found then return false; end if;

  -- paid for it and access hasn't ended (also after the product was hidden)
  if public.purchase_active(p_user, p_product) then return true; end if;
  -- free while active
  if p.is_active and (p.is_free or p.price = 0) then return true; end if;

  -- the VITEEE Question Bank: an earlier Question Bank purchase, or a crash course that includes it (access not ended)
  if p.slug = 'viteee-question-bank' or p.category = 'question_bank' then
    if exists (select 1 from public.purchases pu join public.products b on b.id = pu.product_id
                where pu.user_id = p_user and pu.status = 'paid' and (pu.access_until is null or pu.access_until > now())
                  and b.category = 'question_bank'
                  and (p.slug = 'viteee-question-bank' or b.subject = 'pcm')) then
      return true;
    end if;
    if exists (select 1 from public.purchases pu join public.products c on c.id = pu.product_id
                where pu.user_id = p_user and pu.status = 'paid' and (pu.access_until is null or pu.access_until > now())
                  and c.category = 'crash_course' and c.includes_question_bank) then
      return true;
    end if;
  end if;
  return false;
end;
$$;
revoke all on function public.can_access_product(uuid, uuid) from public, anon;
grant execute on function public.can_access_product(uuid, uuid) to authenticated, service_role;

-- private class links: closed when access has ended
create or replace function public.get_product_content(p_product_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select p.content_links
  from public.products p
  where p.id = p_product_id
    and (public.is_admin() or public.purchase_active(auth.uid(), p.id) or (p.is_active and p.is_free));
$$;

-- ---------- a product's duration changed → its existing buyers (admin only) ----------
--   lifetime → everyone lifetime;  days → buyers without an end get it counted from today;
--   until    → everyone gets that end date.  Ends set by an admin by hand are never touched.
create or replace function public.apply_product_access(p_product uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  k text;
  n integer := 0;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'not allowed'; end if;
  select coalesce(details -> 'access' ->> 'kind', 'lifetime') into k from public.products where id = p_product;
  if k = 'lifetime' then
    update public.purchases set access_until = null, access_set_by = 'auto'
     where product_id = p_product and status = 'paid' and access_until is not null and access_set_by is distinct from 'admin';
  elsif k = 'days' then
    update public.purchases set access_until = public.access_end_for(p_product, now()), access_set_by = 'auto'
     where product_id = p_product and status = 'paid' and access_until is null and access_set_by is distinct from 'admin';
  else
    update public.purchases set access_until = public.access_end_for(p_product, now()), access_set_by = 'auto', access_reminder_sent_at = null
     where product_id = p_product and status = 'paid' and access_set_by is distinct from 'admin'
       and access_until is distinct from public.access_end_for(p_product, now());
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.apply_product_access(uuid) from public, anon;
grant execute on function public.apply_product_access(uuid) to authenticated, service_role;

-- ---------- admin extends one student's access (null = lifetime) ----------
create or replace function public.extend_access(p_purchase uuid, p_until timestamptz)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Only admins can change access.'; end if;
  update public.purchases set access_until = p_until, access_set_by = 'admin', access_reminder_sent_at = null
   where id = p_purchase and status = 'paid';
  if not found then raise exception 'Purchase not found.'; end if;
end;
$$;
revoke all on function public.extend_access(uuid, timestamptz) from public, anon;
grant execute on function public.extend_access(uuid, timestamptz) to authenticated;
