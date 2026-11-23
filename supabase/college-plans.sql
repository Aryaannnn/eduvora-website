-- =====================================================================
--  COLLEGE PLAN after a counselling call (one per booking)
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs setup.sql and counsellor.sql — is_staff().)
--
--  • Admins / counsellors (2-step login) write it in Admin → Bookings →
--    "Write college plan": save as draft or publish.
--  • Only the student who BOOKED sees it, and only once it is published
--    (Dashboard → My Bookings → "Your college plan" + PDF).
--  • Row Level Security: staff read / write; the student reads their own
--    published plan; nobody else. The student is always taken from the
--    booking itself (never from the form).
-- =====================================================================

create table if not exists public.college_plans (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null unique references public.bookings (id) on delete cascade,
  student_id      uuid references auth.users (id) on delete set null,
  status          text not null default 'draft' check (status in ('draft', 'published')),
  campuses        text[] not null default '{}',   -- in order
  branches        text[] not null default '{}',
  fee_category    text check (fee_category is null or char_length(fee_category) <= 60),
  choice_order    text[] not null default '{}',   -- choice-filling order
  next_steps      text[] not null default '{}',   -- checklist
  notes           text check (notes is null or char_length(notes) <= 4000),
  counsellor_id   uuid references auth.users (id) on delete set null,
  counsellor_name text,
  published_at    timestamptz,
  seen_at         timestamptz,                    -- the student opened it ("New" badge until then)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists college_plans_student_idx on public.college_plans (student_id, status);

-- student from the booking; times; "New" again when re-published
create or replace function public.college_plans_before_write()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select b.user_id into new.student_id from public.bookings b where b.id = new.booking_id;
  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
    new.seen_at := null;
  end if;
  if new.status = 'draft' then new.published_at := null; end if;
  return new;
end;
$$;
drop trigger if exists college_plans_before_write on public.college_plans;
create trigger college_plans_before_write before insert or update on public.college_plans
  for each row execute function public.college_plans_before_write();

alter table public.college_plans enable row level security;
drop policy if exists "college plans: staff or the student" on public.college_plans;
create policy "college plans: staff or the student" on public.college_plans
  for select to authenticated using (public.is_staff() or (status = 'published' and student_id = auth.uid()));
drop policy if exists "college plans: staff add" on public.college_plans;
create policy "college plans: staff add" on public.college_plans
  for insert to authenticated with check (public.is_staff());
drop policy if exists "college plans: staff edit" on public.college_plans;
create policy "college plans: staff edit" on public.college_plans
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "college plans: admin delete" on public.college_plans;
create policy "college plans: admin delete" on public.college_plans
  for delete to authenticated using (public.is_admin());
revoke all on public.college_plans from anon;

-- The student opened their plan → no more "New" badge (only their own, published plan)
create or replace function public.mark_college_plan_seen(p_plan uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.college_plans set seen_at = now()
   where id = p_plan and student_id = auth.uid() and status = 'published' and seen_at is null;
$$;
revoke all on function public.mark_college_plan_seen(uuid) from public, anon;
grant execute on function public.mark_college_plan_seen(uuid) to authenticated;
