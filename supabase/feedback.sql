-- =====================================================================
--  POST-SESSION FEEDBACK
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Run after setup.sql, stats-reviews.sql and emails-invoices.sql.)
--
--  1. session_feedback — one feedback per counselling booking:
--     rating 1–5, "What helped you most?", "What can we improve?" and the
--     "You can show my feedback as a review" permission.
--  2. bookings.feedback_email_sent_at — the feedback email goes out once.
--  3. complete_past_bookings() — confirmed sessions whose time has passed
--     become 'completed' (run by the website's cron every 15 minutes).
--  4. publish_feedback_as_review() — admin one-click "Publish as review",
--     ONLY when the student gave permission.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The feedback table
-- ---------------------------------------------------------------------
create table if not exists public.session_feedback (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null unique references public.bookings (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,   -- account deleted → feedback deleted
  rating        smallint not null check (rating between 1 and 5),
  helped_most   text check (helped_most is null or char_length(helped_most) <= 1000),
  improve       text check (improve is null or char_length(improve) <= 1000),
  allow_public  boolean not null default false,       -- "You can show my feedback as a review on the website"
  consent_at    timestamptz,
  review_id     uuid references public.reviews (id) on delete set null,   -- set when published
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists session_feedback_user_idx on public.session_feedback (user_id);
create index if not exists session_feedback_created_idx on public.session_feedback (created_at desc);

alter table public.session_feedback enable row level security;

-- Students: only their own feedback, only for their own COMPLETED session
drop policy if exists "feedback: read own"     on public.session_feedback;
drop policy if exists "feedback: write own"    on public.session_feedback;
drop policy if exists "feedback: edit own"     on public.session_feedback;
drop policy if exists "feedback: admin reads"  on public.session_feedback;
drop policy if exists "feedback: admin delete" on public.session_feedback;

create policy "feedback: read own" on public.session_feedback
  for select to authenticated using (user_id = auth.uid());
create policy "feedback: write own" on public.session_feedback
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.bookings b
                 where b.id = booking_id and b.user_id = auth.uid() and b.status = 'completed'));
create policy "feedback: edit own" on public.session_feedback
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "feedback: admin reads" on public.session_feedback
  for select to authenticated using (public.is_admin());
create policy "feedback: admin delete" on public.session_feedback
  for delete to authenticated using (public.is_admin());

revoke all on table public.session_feedback from anon;

-- Students can't change whose feedback it is, which booking, or the "published" link
create or replace function public.before_feedback_write()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.user_id := auth.uid();
    if tg_op = 'UPDATE' then
      new.booking_id := old.booking_id;
      new.review_id  := old.review_id;
      new.created_at := old.created_at;
    else
      new.review_id := null;
    end if;
  end if;
  new.helped_most := nullif(btrim(new.helped_most), '');
  new.improve     := nullif(btrim(new.improve), '');
  if new.allow_public and (tg_op = 'INSERT' or not old.allow_public) then
    new.consent_at := now();
  elsif not new.allow_public then
    new.consent_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists before_feedback_write on public.session_feedback;
create trigger before_feedback_write before insert or update on public.session_feedback
  for each row execute function public.before_feedback_write();

-- ---------------------------------------------------------------------
-- 2. "Feedback email sent" marker on bookings (students can't change it)
-- ---------------------------------------------------------------------
alter table public.bookings add column if not exists feedback_email_sent_at timestamptz;

create or replace function public.protect_booking_feedback_mark()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and new.feedback_email_sent_at is distinct from old.feedback_email_sent_at then
    raise exception 'You are not allowed to change these booking details.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_booking_feedback_mark on public.bookings;
create trigger protect_booking_feedback_mark
  before update on public.bookings
  for each row execute function public.protect_booking_feedback_mark();

-- ---------------------------------------------------------------------
-- 3. Confirmed sessions whose end time has passed → 'completed'
--    (slot times are India time). Server only.
-- ---------------------------------------------------------------------
create or replace function public.complete_past_bookings()
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  update public.bookings b
     set status = 'completed'
    from public.slots s
   where s.id = b.slot_id
     and b.status = 'confirmed'
     and ((s.date + s.end_time) at time zone 'Asia/Kolkata') < now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.complete_past_bookings() from public, anon, authenticated;
grant execute on function public.complete_past_bookings() to service_role;

-- ---------------------------------------------------------------------
-- 4. Admin: "Publish as review" (only with the student's permission)
--    Creates an APPROVED review: their first name, rating, and their answer
--    to "What helped you most?". "What can we improve?" is never published.
-- ---------------------------------------------------------------------
create or replace function public.publish_feedback_as_review(p_feedback uuid, p_name text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  f public.session_feedback;
  b public.bookings;
  rid uuid;
  owner uuid;
  shown text;
begin
  if not public.is_admin() then raise exception 'Only admins can publish feedback.'; end if;
  select * into f from public.session_feedback where id = p_feedback for update;
  if not found then raise exception 'Feedback not found.'; end if;
  if f.review_id is not null and exists (select 1 from public.reviews where id = f.review_id) then
    return f.review_id;                                        -- already published
  end if;
  if not f.allow_public then raise exception 'The student did not give permission to show this feedback.'; end if;
  if f.helped_most is null or char_length(f.helped_most) < 10 then
    raise exception 'This feedback has no written comment to show as a review.';
  end if;

  select * into b from public.bookings where id = f.booking_id;
  shown := coalesce(nullif(btrim(p_name), ''), split_part(coalesce(b.name, 'Student'), ' ', 1));
  -- One review per student account: link it to them only if they have none yet
  owner := case when exists (select 1 from public.reviews where user_id = f.user_id) then null else f.user_id end;

  insert into public.reviews (name, type, rating, comment, is_approved, user_id, is_verified, consent_given, consent_at)
  values (left(shown, 60), 'student', f.rating, f.helped_most, true, owner,
          coalesce(b.payment_status = 'paid', false), true, coalesce(f.consent_at, f.created_at))
  returning id into rid;

  update public.session_feedback set review_id = rid where id = f.id;
  return rid;
end;
$$;
revoke all on function public.publish_feedback_as_review(uuid, text) from public, anon;
grant execute on function public.publish_feedback_as_review(uuid, text) to authenticated;
