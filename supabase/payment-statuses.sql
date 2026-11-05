-- =====================================================================
--  EDUVORA — PAYMENT STATUSES (run this one; it also includes
--  abandoned-payments.sql, so it doesn't matter if you ran that or not)
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE
--  file → click "Run". Safe to run again.
--
--  Purchase statuses:
--    created    (HIDDEN) Razorpay order made, popup opened — not paid yet
--    paid       shown — money received, item unlocked, invoice number
--    failed     shown — Razorpay reported the payment failed
--    abandoned  (HIDDEN) popup closed / never paid (checked with Razorpay)
--    pending    old name for "created" (kept so old rows stay valid)
-- =====================================================================

alter table public.purchases drop constraint if exists purchases_status_check;
alter table public.purchases add constraint purchases_status_check
  check (status in ('created', 'pending', 'paid', 'failed', 'abandoned'));
alter table public.purchases alter column status set default 'created';

alter table public.purchases add column if not exists failure_reason text;
alter table public.purchases add column if not exists checked_at     timestamptz; -- last time we asked Razorpay

-- Finds hidden attempts that need checking, quickly
drop index if exists public.purchases_pending_idx;
create index if not exists purchases_hidden_idx on public.purchases (created_at)
  where status in ('created', 'pending');
