-- =====================================================================
--  FREE RESOURCES — run once in Supabase → SQL Editor → Run
--  Free tests now need a LOGIN (students must sign up to use free items).
--  Paid tests keep the same rule: bought it, or admin.
--  Safe to run more than once.
-- =====================================================================

create or replace function public.assert_can_attempt(p_test_id uuid)
returns public.tests
language plpgsql stable security definer set search_path = public
as $$
declare
  t public.tests;
begin
  select * into t from public.tests where id = p_test_id and (is_active or public.is_admin());
  if not found then
    raise exception 'Test not found.';
  end if;
  -- Every test (free ones too) needs a logged-in student
  if auth.uid() is null then
    raise exception 'Please log in to take this test.';
  end if;
  if not (t.is_free or public.is_admin() or (t.product_id is not null and public.has_purchased(t.product_id))) then
    raise exception 'Please buy this test to attempt it.';
  end if;
  return t;
end;
$$;
