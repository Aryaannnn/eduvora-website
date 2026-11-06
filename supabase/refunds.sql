-- =====================================================================
--  EDUVORA — REFUND STATUS FOR PAYMENTS
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE
--  file → click "Run". Run it AFTER payments.sql and payment-statuses.sql.
--  Safe to run again.
--
--  Adds the purchase status 'refunded' (Admin → Payments → "Mark as refunded"):
--   • the student loses access to that item,
--   • it no longer counts in revenue,
--   • a late "payment captured" message from Razorpay can never turn it
--     back into 'paid'.
--  (The money itself is refunded in your Razorpay Dashboard → Payments → Refund.)
-- =====================================================================

alter table public.purchases drop constraint if exists purchases_status_check;
alter table public.purchases add constraint purchases_status_check
  check (status in ('created', 'pending', 'paid', 'failed', 'abandoned', 'refunded'));

alter table public.purchases add column if not exists refunded_at timestamptz;
alter table public.purchases add column if not exists refund_note text check (refund_note is null or char_length(refund_note) <= 300);
alter table public.purchases add column if not exists refunded_by uuid references auth.users (id) on delete set null;

-- Same as payments.sql, but a REFUNDED purchase is never marked paid again
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
       and status not in ('paid', 'refunded')
    returning *;
  if not found then
    return query select * from public.purchases where razorpay_order_id = p_order_id;
  end if;
end;
$$;
revoke all on function public.mark_purchase_paid(text, text) from public, anon, authenticated;
grant execute on function public.mark_purchase_paid(text, text) to service_role;
