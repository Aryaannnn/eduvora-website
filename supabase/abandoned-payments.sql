-- =====================================================================
--  EDUVORA — "ABANDONED" PAYMENTS
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE
--  file → click "Run". Safe to run again.
--
--  Adds a new purchase status 'abandoned' = the student opened the
--  Razorpay popup but did not pay within 30 minutes. The website checks
--  with Razorpay first, so a real payment is marked 'paid', never abandoned.
-- =====================================================================

alter table public.purchases drop constraint if exists purchases_status_check;
alter table public.purchases add constraint purchases_status_check
  check (status in ('created', 'pending', 'paid', 'failed', 'abandoned', 'refunded'));

-- When we looked at it (so the sweep doesn't check the same order again and again)
alter table public.purchases add column if not exists checked_at timestamptz;

-- Finds old pending orders quickly
create index if not exists purchases_pending_idx on public.purchases (created_at) where status = 'pending';
