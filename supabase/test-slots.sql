-- =====================================================================
--  TEST SLOTS (Admin → Slots → "Add test slots" / "Delete all test slots")
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs setup.sql and booking-payment-first.sql.)
--
--  add_test_slots():
--    • the next 7 days (tomorrow … +7, India time): 30-minute slots
--      10:00 AM – 1:00 PM and 4:00 PM – 6:00 PM at ₹499, marked is_test
--    • skips any time that already has (or overlaps) a slot
--    • 2 of them get a sample booking ("TEST booking (sample)", not paid,
--      owned by the admin who pressed the button) so you can see "Booked":
--      tomorrow 10:30 AM and the day after at 4:00 PM
--  delete_test_slots():
--    • removes test slots that have NO paid (or refunded) booking, together
--      with their unpaid / sample bookings. Slots with a real payment stay.
-- =====================================================================
alter table public.slots add column if not exists is_test boolean not null default false;

create or replace function public.add_test_slots()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me      uuid := auth.uid();
  today   date := (now() at time zone 'Asia/Kolkata')::date;
  starts  time[] := array['10:00','10:30','11:00','11:30','12:00','12:30','16:00','16:30','17:00','17:30']::time[];
  d       date;
  t       time;
  s_id    uuid;
  created integer := 0;
  skipped integer := 0;
  booked  integer := 0;
begin
  if not public.is_admin() then raise exception 'Only admins can do this.'; end if;

  for i in 1..7 loop
    d := today + i;
    foreach t in array starts loop
      if exists (select 1 from public.slots x
                  where x.date = d and x.start_time < t + interval '30 minutes' and x.end_time > t) then
        skipped := skipped + 1;   -- already a slot at (or overlapping) this time
      else
        insert into public.slots (date, start_time, end_time, price, is_available, is_test)
        values (d, t, t + interval '30 minutes', 499, true, true);
        created := created + 1;
      end if;
    end loop;
  end loop;

  -- Two sample bookings so "Booked" can be seen (only on free test slots without any booking)
  for s_id in
    select s.id from public.slots s
     where s.is_test and s.is_available
       and ((s.date = today + 1 and s.start_time = '10:30') or (s.date = today + 2 and s.start_time = '16:00'))
       and not exists (select 1 from public.bookings b where b.slot_id = s.id)
  loop
    -- 'pending' + 'unpaid': shows as Booked, but no emails, reminders, invoice or payment
    insert into public.bookings (user_id, slot_id, name, phone, message, status, payment_status, amount)
    values (me, s_id, 'TEST booking (sample)', '+919999999999',
            'Sample booking made by "Add test slots" — not a real student.', 'pending', 'unpaid', 0);
    booked := booked + 1;
  end loop;

  return jsonb_build_object('created', created, 'skipped', skipped, 'booked', booked);
end;
$$;
revoke all on function public.add_test_slots() from public, anon;
grant execute on function public.add_test_slots() to authenticated, service_role;

create or replace function public.delete_test_slots()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  removed_bookings integer;
  removed_slots    integer;
  kept             integer;
begin
  if not public.is_admin() then raise exception 'Only admins can do this.'; end if;

  -- 1. unpaid / sample bookings on test slots that have no paid (or refunded) booking
  delete from public.bookings b
   using public.slots s
   where b.slot_id = s.id and s.is_test
     and not exists (select 1 from public.bookings p where p.slot_id = s.id and p.payment_status in ('paid', 'refunded'));
  get diagnostics removed_bookings = row_count;
  -- 2. then every test slot that has no booking left
  delete from public.slots s
   where s.is_test and not exists (select 1 from public.bookings b where b.slot_id = s.id);
  get diagnostics removed_slots = row_count;
  select count(*) into kept from public.slots where is_test;

  return jsonb_build_object('removed_slots', removed_slots, 'removed_bookings', removed_bookings, 'kept_with_payment', kept);
end;
$$;
revoke all on function public.delete_test_slots() from public, anon;
grant execute on function public.delete_test_slots() to authenticated, service_role;
