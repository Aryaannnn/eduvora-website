-- =====================================================================
--  EDUVORA — RAZORPAY PAYMENTS
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE
--  file → click "Run". Run it AFTER setup.sql. Safe to run again.
--
--  What it adds:
--   • paid_at + failure_reason columns on purchases
--   • invoice numbers like EDU-2026-0001 (a new series every year)
--   • mark_purchase_paid(): marks an order paid exactly once, even if the
--     browser and the Razorpay webhook both report the same payment
--  Only the website's server (service role key) can run these functions.
--  Students still can't change their purchases (see setup.sql RLS).
-- =====================================================================

alter table public.purchases add column if not exists paid_at        timestamptz;
alter table public.purchases add column if not exists failure_reason text;

-- One running counter per year
create table if not exists public.invoice_counters (
  year integer primary key,
  last integer not null default 0
);
alter table public.invoice_counters enable row level security; -- no policies = nobody but the server

-- Next invoice number: EDU-2026-0001, EDU-2026-0002, …
create or replace function public.next_invoice_number()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  y int := extract(year from (now() at time zone 'Asia/Kolkata'))::int;
  n int;
begin
  insert into public.invoice_counters as c (year, last) values (y, 1)
  on conflict (year) do update set last = c.last + 1
  returning last into n;
  return 'EDU-' || y || '-' || lpad(n::text, 4, '0');
end;
$$;

-- Mark the purchase for a Razorpay order as PAID (only once).
-- Returns the purchase row; does nothing if it is already paid.
create or replace function public.mark_purchase_paid(p_order_id text, p_payment_id text)
returns setof public.purchases
language plpgsql security definer set search_path = public
as $$
begin
  return query
    update public.purchases
       set status              = 'paid',
           razorpay_payment_id = coalesce(p_payment_id, razorpay_payment_id),
           invoice_number      = coalesce(invoice_number, public.next_invoice_number()),
           paid_at             = coalesce(paid_at, now()),
           failure_reason      = null
     where razorpay_order_id = p_order_id
       and status not in ('paid', 'refunded')   -- a refunded purchase is never marked paid again
    returning *;
  if not found then
    return query select * from public.purchases where razorpay_order_id = p_order_id;
  end if;
end;
$$;

-- Only the server (service_role) may call these — not visitors or students
revoke all on function public.next_invoice_number()              from public, anon, authenticated;
revoke all on function public.mark_purchase_paid(text, text)     from public, anon, authenticated;
grant execute on function public.next_invoice_number()           to service_role;
grant execute on function public.mark_purchase_paid(text, text)  to service_role;
revoke all on public.invoice_counters from anon, authenticated;

create index if not exists purchases_order_idx on public.purchases (razorpay_order_id);
