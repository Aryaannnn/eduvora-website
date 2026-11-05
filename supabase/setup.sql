-- =====================================================================
--  EDUVORA — COMPLETE SUPABASE SETUP
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE
--  file → click "Run". It is safe to run again (it won't duplicate data).
--
--  Sections:
--   1. Tables            5. Test functions (server-side scoring)
--   2. Helper functions  6. Storage bucket for paid PDFs
--   3. Triggers          7. Sample data
--   4. Security (RLS)
-- =====================================================================


-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- One row per user (created automatically when someone signs up)
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  role        text not null default 'student' check (role in ('student', 'parent', 'admin')),
  created_at  timestamptz not null default now()
);

-- Everything you sell: crash courses, study material, previous papers, mock tests
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  slug            text not null unique,           -- used in the web address, e.g. viteee-45-day-crash-course
  description     text,
  category        text not null check (category in ('crash_course', 'study_material', 'previous_paper', 'mock_test')),
  college         text,                           -- for study material, e.g. 'VIT Vellore'
  price           integer not null default 0 check (price >= 0),        -- in rupees
  original_price  integer check (original_price is null or original_price >= 0), -- optional "strike-through" price
  is_free         boolean not null default false,
  is_active       boolean not null default true,  -- untick to hide from the website
  thumbnail_url   text,
  file_path       text,                           -- path of the PDF inside the 'materials' storage bucket
  content_links   jsonb not null default '[]'::jsonb, -- private links (videos, classes) — only buyers can read these
  details         jsonb not null default '{}'::jsonb, -- extra display info: features, duration, badge, syllabus…
  sort_order      integer not null default 0,     -- lower number = shown first
  created_at      timestamptz not null default now()
);

create table if not exists public.purchases (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  product_id           uuid not null references public.products (id) on delete restrict,
  amount               integer not null check (amount >= 0),  -- in rupees
  razorpay_order_id    text unique,
  razorpay_payment_id  text unique,
  status               text not null default 'created' check (status in ('created', 'pending', 'paid', 'failed', 'abandoned')), -- created / abandoned are hidden attempts
  invoice_number       text unique,
  created_at           timestamptz not null default now()
);

-- Counselling call time slots
create table if not exists public.slots (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  start_time    time not null,
  end_time      time not null,
  price         integer not null default 0 check (price >= 0),
  is_available  boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint slots_time_order check (end_time > start_time),
  constraint slots_unique_start unique (date, start_time)
);

create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  slot_id         uuid not null references public.slots (id) on delete restrict,
  name            text not null,
  phone           text not null,
  email           text,
  message         text,
  status          text not null default 'pending' check (status in ('awaiting_payment', 'pending', 'confirmed', 'cancelled', 'completed', 'expired')),
  payment_status  text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  created_at      timestamptz not null default now()
);
-- Online (Razorpay) payment details — filled in only by the server
alter table public.bookings add column if not exists amount              integer check (amount is null or amount >= 0);
alter table public.bookings add column if not exists razorpay_order_id   text unique;
alter table public.bookings add column if not exists razorpay_payment_id text unique;
alter table public.bookings add column if not exists paid_at             timestamptz;
alter table public.bookings add column if not exists class_year          text;
alter table public.bookings add column if not exists expected_marks      numeric(5,2);
alter table public.bookings add column if not exists hold_expires_at     timestamptz;
alter table public.bookings add column if not exists invoice_number      text unique;

create table if not exists public.tests (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid references public.products (id) on delete set null,
  title             text not null,
  type              text not null check (type in ('mock', 'mcq')),
  duration_minutes  integer not null default 30 check (duration_minutes > 0),
  total_marks       integer not null default 0,  -- updated automatically from the questions
  is_free           boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references public.tests (id) on delete cascade,
  question        text not null,
  options         jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_option  smallint not null check (correct_option between 0 and 3), -- 0 = first option … 3 = fourth
  explanation     text,
  marks           integer not null default 1 check (marks > 0),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists public.test_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  test_id       uuid not null references public.tests (id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb,
  score         integer not null default 0,
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz
);

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null check (type in ('student', 'parent')),
  rating       smallint not null check (rating between 1 and 5),
  comment      text not null,
  photo_url    text,
  is_approved  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Speed up common lookups
create index if not exists products_category_idx   on public.products (category, is_active, sort_order);
create index if not exists purchases_user_idx        on public.purchases (user_id);
create index if not exists purchases_product_idx     on public.purchases (product_id);
create index if not exists bookings_user_idx         on public.bookings (user_id);
create index if not exists bookings_slot_idx         on public.bookings (slot_id);
create index if not exists slots_date_idx            on public.slots (date, start_time);
create index if not exists tests_product_idx         on public.tests (product_id);
create index if not exists questions_test_idx        on public.questions (test_id, sort_order);
create index if not exists test_attempts_user_idx    on public.test_attempts (user_id);
create index if not exists test_attempts_test_idx    on public.test_attempts (test_id);


-- =====================================================================
-- 2. HELPER FUNCTIONS (used by the security rules)
-- =====================================================================

-- true if the logged-in user is an admin
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- true if the logged-in user has PAID for this product
create or replace function public.has_purchased(p_product_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.purchases
    where user_id = auth.uid() and product_id = p_product_id and status = 'paid'
  );
$$;


-- =====================================================================
-- 3. TRIGGERS (things that happen automatically)
-- =====================================================================

-- 3a. Create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := lower(coalesce(new.raw_user_meta_data ->> 'role', 'student'));
begin
  -- Never trust the sign-up form for 'admin'
  if v_role not in ('student', 'parent') then
    v_role := 'student';
  end if;

  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.phone,
    v_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3b. Students cannot make themselves admin
create or replace function public.protect_profile_role()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'You are not allowed to change your role.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- @@BOOKING_TRIGGERS_START@@
-- New bookings: students can't pre-fill payment fields; the slot is taken atomically
create or replace function public.before_booking_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.user_id             := auth.uid();
    new.status              := 'pending';
    new.payment_status      := 'unpaid';
    new.amount              := null;   -- payment fields are set only by the server
    new.razorpay_order_id   := null;
    new.razorpay_payment_id := null;
    new.paid_at             := null;
    new.invoice_number      := null;
    new.hold_expires_at     := null;
  end if;

  update public.slots
     set is_available = false
   where id = new.slot_id and is_available and date >= current_date;

  if not found then
    raise exception 'This slot is no longer available. Please choose another one.';
  end if;
  return new;
end;
$$;

drop trigger if exists before_booking_insert on public.bookings;
create trigger before_booking_insert
  before insert on public.bookings
  for each row execute function public.before_booking_insert();

-- Students may only CANCEL; cancelling or an expired hold frees the slot again
create or replace function public.before_booking_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.user_id <> old.user_id
       or new.slot_id <> old.slot_id
       or new.payment_status      is distinct from old.payment_status
       or new.amount              is distinct from old.amount
       or new.razorpay_order_id   is distinct from old.razorpay_order_id
       or new.razorpay_payment_id is distinct from old.razorpay_payment_id
       or new.paid_at             is distinct from old.paid_at
       or new.invoice_number      is distinct from old.invoice_number
       or new.hold_expires_at     is distinct from old.hold_expires_at then
      raise exception 'You are not allowed to change these booking details.';
    end if;
    if new.status is distinct from old.status
       and not (new.status = 'cancelled' and old.status in ('pending', 'confirmed')) then
      raise exception 'You can only cancel a booking.';
    end if;
  end if;

  if new.status in ('cancelled', 'expired') and old.status not in ('cancelled', 'expired') then
    update public.slots set is_available = true
     where id = old.slot_id and date >= current_date;
  end if;
  return new;
end;
$$;

drop trigger if exists before_booking_update on public.bookings;
create trigger before_booking_update
  before update on public.bookings
  for each row execute function public.before_booking_update();
-- @@BOOKING_TRIGGERS_END@@

-- 3e. Keep tests.total_marks equal to the sum of its questions' marks
create or replace function public.update_test_total_marks()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_test_id uuid := coalesce(new.test_id, old.test_id);
begin
  update public.tests
     set total_marks = (select coalesce(sum(marks), 0) from public.questions where test_id = v_test_id)
   where id = v_test_id;
  if tg_op = 'UPDATE' and new.test_id <> old.test_id then
    update public.tests
       set total_marks = (select coalesce(sum(marks), 0) from public.questions where test_id = old.test_id)
     where id = old.test_id;
  end if;
  return null;
end;
$$;

drop trigger if exists update_test_total_marks on public.questions;
create trigger update_test_total_marks
  after insert or update or delete on public.questions
  for each row execute function public.update_test_total_marks();


-- =====================================================================
-- 4. SECURITY — ROW LEVEL SECURITY (who can see / change what)
-- =====================================================================

alter table public.profiles      enable row level security;
alter table public.products      enable row level security;
alter table public.purchases     enable row level security;
alter table public.slots         enable row level security;
alter table public.bookings      enable row level security;
alter table public.tests         enable row level security;
alter table public.questions     enable row level security;
alter table public.test_attempts enable row level security;
alter table public.reviews       enable row level security;

-- Remove old versions of our rules (so this file can be re-run)
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','products','purchases','slots','bookings','tests','questions','test_attempts','reviews')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ---------- profiles: own row only (admins: everyone) ----------
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: update own or admin" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy "profiles: admin delete" on public.profiles
  for delete to authenticated using (public.is_admin());

-- ---------- products: anyone sees active ones; admins manage ----------
create policy "products: anyone reads active" on public.products
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "products: admin insert" on public.products
  for insert to authenticated with check (public.is_admin());
create policy "products: admin update" on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "products: admin delete" on public.products
  for delete to authenticated using (public.is_admin());

-- content_links are paid content: hide that column from direct reads.
-- Buyers get it through the get_product_content() function below.
revoke select on public.products from anon, authenticated;
grant select (id, title, slug, description, category, college, price, original_price, is_free, is_active,
              thumbnail_url, file_path, details, sort_order, created_at)
  on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

-- ---------- purchases: students see their own; only admins (or the payment server) write ----------
create policy "purchases: read own or admin" on public.purchases
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "purchases: admin insert" on public.purchases
  for insert to authenticated with check (public.is_admin());
create policy "purchases: admin update" on public.purchases
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "purchases: admin delete" on public.purchases
  for delete to authenticated using (public.is_admin());

-- ---------- slots: anyone sees available ones; students also see slots they booked ----------
create policy "slots: read available, own booked, or admin" on public.slots
  for select to anon, authenticated using (
    is_available
    or public.is_admin()
    or exists (select 1 from public.bookings b where b.slot_id = slots.id and b.user_id = auth.uid())
  );
create policy "slots: admin insert" on public.slots
  for insert to authenticated with check (public.is_admin());
create policy "slots: admin update" on public.slots
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "slots: admin delete" on public.slots
  for delete to authenticated using (public.is_admin());

-- ---------- bookings: students see/cancel their own; the server creates them ----------
create policy "bookings: read own or admin" on public.bookings
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- Only the website's server creates bookings (after "Pay & Book"); see booking-payment-first.sql
create policy "bookings: admin insert" on public.bookings
  for insert to authenticated with check (public.is_admin());
create policy "bookings: update own or admin" on public.bookings
  for update to authenticated using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "bookings: admin delete" on public.bookings
  for delete to authenticated using (public.is_admin());

-- ---------- tests: anyone sees active tests (title, time, marks); admins manage ----------
create policy "tests: anyone reads active" on public.tests
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "tests: admin insert" on public.tests
  for insert to authenticated with check (public.is_admin());
create policy "tests: admin update" on public.tests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "tests: admin delete" on public.tests
  for delete to authenticated using (public.is_admin());

-- ---------- questions: ONLY admins can read the table directly ----------
-- Students get questions WITHOUT answers through get_test_for_attempt(),
-- and answers are checked on the server by submit_test().
create policy "questions: admin read" on public.questions
  for select to authenticated using (public.is_admin());
create policy "questions: admin insert" on public.questions
  for insert to authenticated with check (public.is_admin());
create policy "questions: admin update" on public.questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "questions: admin delete" on public.questions
  for delete to authenticated using (public.is_admin());

-- ---------- test_attempts: students see their own; only submit_test() creates them ----------
-- (Students cannot insert or edit attempts directly, so nobody can fake a score.)
create policy "attempts: read own or admin" on public.test_attempts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "attempts: admin delete" on public.test_attempts
  for delete to authenticated using (public.is_admin());

-- ---------- reviews: anyone sees approved ones; admins manage ----------
create policy "reviews: anyone reads approved" on public.reviews
  for select to anon, authenticated using (is_approved or public.is_admin());
create policy "reviews: admin insert" on public.reviews
  for insert to authenticated with check (public.is_admin());
create policy "reviews: admin update" on public.reviews
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "reviews: admin delete" on public.reviews
  for delete to authenticated using (public.is_admin());


-- =====================================================================
-- 5. TEST FUNCTIONS — questions without answers + scoring on the server
-- =====================================================================

-- Checks the user may attempt the test (free test, bought it, or admin)
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
  if not (t.is_free or public.is_admin() or (t.product_id is not null and public.has_purchased(t.product_id))) then
    raise exception 'Please buy this test to attempt it.';
  end if;
  return t;
end;
$$;

-- Returns the test and its questions — WITHOUT correct answers or explanations
create or replace function public.get_test_for_attempt(p_test_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  t public.tests;
begin
  t := public.assert_can_attempt(p_test_id);
  return jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'type', t.type,
    'duration_minutes', t.duration_minutes,
    'total_marks', t.total_marks,
    'questions', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', q.id, 'question', q.question, 'options', q.options, 'marks', q.marks)
               order by q.sort_order, q.created_at)
      from public.questions q
      where q.test_id = t.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Scores the answers ON THE SERVER, saves the attempt (if logged in),
-- and only THEN returns the correct answers and explanations.
-- p_answers looks like: {"<question id>": 2, "<question id>": 0, ...}
create or replace function public.submit_test(p_test_id uuid, p_answers jsonb, p_started_at timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  t          public.tests;
  v_answers  jsonb := coalesce(p_answers, '{}'::jsonb);
  v_score    integer;
  v_total    integer;
  v_results  jsonb;
  v_attempt  uuid;
begin
  t := public.assert_can_attempt(p_test_id);
  if jsonb_typeof(v_answers) <> 'object' then
    raise exception 'Answers must be an object.';
  end if;

  select
    coalesce(sum(q.marks) filter (where (v_answers ->> q.id::text) = q.correct_option::text), 0),
    coalesce(sum(q.marks), 0),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'question_id', q.id,
        'your_answer', v_answers -> q.id::text,
        'correct_option', q.correct_option,
        'explanation', q.explanation,
        'marks', q.marks
      ) order by q.sort_order, q.created_at), '[]'::jsonb)
  into v_score, v_total, v_results
  from public.questions q
  where q.test_id = t.id;

  if auth.uid() is not null then
    insert into public.test_attempts (user_id, test_id, answers, score, started_at, submitted_at)
    values (auth.uid(), t.id, v_answers, v_score, least(coalesce(p_started_at, now()), now()), now())
    returning id into v_attempt;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt,
    'score', v_score,
    'total_marks', v_total,
    'results', v_results
  );
end;
$$;

-- Private course links for buyers (and free products)
create or replace function public.get_product_content(p_product_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select p.content_links
  from public.products p
  where p.id = p_product_id
    and p.is_active
    and (p.is_free or public.is_admin() or public.has_purchased(p.id));
$$;

-- Only these functions may be called from the website
revoke execute on function public.assert_can_attempt(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.get_test_for_attempt(uuid) to anon, authenticated;
grant execute on function public.submit_test(uuid, jsonb, timestamptz) to anon, authenticated;
revoke execute on function public.get_product_content(uuid) from public, anon;
grant execute on function public.get_product_content(uuid) to authenticated;


-- =====================================================================
-- 6. STORAGE — private 'materials' bucket for paid PDFs
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do update set public = false;

drop policy if exists "materials: buyers can download" on storage.objects;
drop policy if exists "materials: admin upload" on storage.objects;
drop policy if exists "materials: admin update" on storage.objects;
drop policy if exists "materials: admin delete" on storage.objects;

-- A logged-in student can download a file only if the product that uses
-- that file is free, or they have PAID for it. Admins can download all.
create policy "materials: buyers can download" on storage.objects
  for select to authenticated using (
    bucket_id = 'materials' and (
      public.is_admin()
      or exists (
        select 1 from public.products p
        where p.file_path = storage.objects.name
          and p.is_active
          and (p.is_free or public.has_purchased(p.id))
      )
    )
  );
create policy "materials: admin upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'materials' and public.is_admin());
create policy "materials: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'materials' and public.is_admin());
create policy "materials: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'materials' and public.is_admin());


-- =====================================================================
-- 7. SAMPLE DATA (so you can see the website working — edit or delete later)
-- =====================================================================

-- ---------- Crash courses ----------
insert into public.products (title, slug, description, category, price, original_price, sort_order, details) values
('VITEEE 45-Day Crash Course', 'viteee-45-day-crash-course',
 'Our flagship programme for a structured, high-speed revision before VITEEE. Every important chapter is covered with concept recaps, shortcut tricks and exam-level practice, followed by full-length mock tests in the real VITEEE pattern.',
 'crash_course', 7999, 11999, 1,
 '{"short":"Complete revision of Maths, Physics, Chemistry, English & Aptitude with daily practice and weekly mock tests.",
   "badge":"Most Popular","duration":"45 days","mode":"Online + Offline","start_date":"1 February 2027",
   "features":["Daily 4-hour live classes","15 full-length mock tests","Chapter-wise PDF notes","Daily doubt sessions"],
   "syllabus":[{"title":"Mathematics","topics":["Calculus","Coordinate Geometry","Vectors & 3D","Probability","Matrices"]},
               {"title":"Physics","topics":["Mechanics","Electrostatics","Current Electricity","Optics","Modern Physics"]},
               {"title":"Chemistry","topics":["Physical","Organic","Inorganic","Chemical Bonding"]},
               {"title":"English & Aptitude","topics":["Comprehension","Grammar","Logical Reasoning"]}],
   "includes":["Live + recorded classes","Printed material (offline batch)","Mock test analysis","1 free counselling call"],
   "faqs":[{"q":"Is this suitable if I haven''t started preparing?","a":"Yes. Every chapter starts from the basics and quickly moves to exam-level questions."},
           {"q":"Will I get class recordings?","a":"Yes, recordings stay available until your exam date."}]}'),
('VITEEE 30-Day Fast Track', 'viteee-30-day-fast-track',
 'For students who have completed the board syllabus and need focused VITEEE practice: high-weightage topics, time management and exam-style questions under timed conditions.',
 'crash_course', 5499, 7999, 2,
 '{"short":"Short, intense revision for students who know the basics and want more speed and accuracy.",
   "duration":"30 days","mode":"Online","start_date":"1 March 2027",
   "features":["High-weightage topics only","10 full-length mock tests","Speed & accuracy drills","Daily practice sheets"],
   "syllabus":[{"title":"Mathematics","topics":["Calculus","Algebra","Coordinate Geometry"]},
               {"title":"Physics","topics":["Mechanics","Electricity & Magnetism","Modern Physics"]},
               {"title":"Chemistry","topics":["Organic reactions","Equilibrium","Periodic properties"]}],
   "includes":["Live classes","Recorded lectures","Practice sheets","Rank predictor report"],
   "faqs":[{"q":"How many hours a day?","a":"About 3 hours of live class plus 2 hours of self-practice."}]}'),
('VITEEE Weekend Batch', 'viteee-weekend-batch',
 'Balance boards and VITEEE. Classes run only on Saturdays and Sundays and cover the full syllabus over 12 weeks, with regular tests to keep you on track.',
 'crash_course', 9999, 13999, 3,
 '{"short":"Weekend-only classes for Class 12 students preparing for VITEEE alongside board exams.",
   "duration":"12 weeks","mode":"Online + Offline","start_date":"10 December 2026",
   "features":["Saturday & Sunday classes","Board + VITEEE approach","Monthly parent updates","8 mock tests"],
   "syllabus":[{"title":"All subjects","topics":["Maths","Physics","Chemistry","English & Aptitude"]}],
   "includes":["Study material","Classroom tests","Parent-teacher meetings"],
   "faqs":[{"q":"Will this clash with school?","a":"No, classes are only on weekends."}]}'),
('Crash Course + Counselling Combo', 'crash-course-plus-counselling',
 'Everything from preparation to admission: the 45-Day Crash Course, a 25-test mock pack, and one-to-one counselling after results.',
 'crash_course', 10999, 14497, 4,
 '{"short":"45-Day Crash Course, full mock test pack and personal counselling at one special price.",
   "badge":"Best Value","duration":"45 days + counselling","mode":"Online + Offline","start_date":"1 February 2027",
   "features":["Full 45-Day Crash Course","25 mock tests","3 counselling sessions","Priority doubt support"],
   "syllabus":[{"title":"Preparation","topics":["45-Day Crash Course","Mock Test Pack"]},{"title":"Admission","topics":["Counselling sessions","Choice filling help"]}],
   "includes":["All course material","All mock tests","Personal counselling"],
   "faqs":[{"q":"Can I pay in instalments?","a":"Yes, two instalments are allowed. Contact us for details."}]}')
on conflict (slug) do nothing;

-- ---------- Study material (one per campus) ----------
insert into public.products (title, slug, description, category, college, price, original_price, file_path, sort_order, details) values
('VIT Vellore Admission Kit', 'vit-vellore-admission-kit',
 'Everything about the main campus: branches, cut-off trends, fee categories and hostel info.',
 'study_material', 'VIT Vellore', 799, 1199, 'study-material/vit-vellore-kit.pdf', 1,
 '{"badge":"Bestseller","format":"PDF + Printed","color":"from-indigo-600 to-blue-500",
   "contents":["Branch-wise rank trends","Fee category guide","Hostel & campus guide","Choice-filling checklist"]}'),
('VIT Chennai Admission Kit', 'vit-chennai-admission-kit',
 'Detailed guide to VIT Chennai programmes, rank ranges and campus life.',
 'study_material', 'VIT Chennai', 699, 999, 'study-material/vit-chennai-kit.pdf', 2,
 '{"format":"PDF + Printed","color":"from-sky-600 to-cyan-500",
   "contents":["Branch-wise rank trends","Fee category guide","Campus & city guide","Choice-filling checklist"]}'),
('VIT-AP Admission Kit', 'vit-ap-admission-kit',
 'Programmes, fee structure and what to expect at the VIT-AP campus.',
 'study_material', 'VIT-AP', 499, 799, 'study-material/vit-ap-kit.pdf', 3,
 '{"format":"PDF","color":"from-emerald-600 to-teal-500",
   "contents":["Programme list","Rank trends","Fee & scholarship info","Choice-filling checklist"]}'),
('VIT Bhopal Admission Kit', 'vit-bhopal-admission-kit',
 'Programmes, fee structure and campus facts for VIT Bhopal.',
 'study_material', 'VIT Bhopal', 499, 799, 'study-material/vit-bhopal-kit.pdf', 4,
 '{"format":"PDF","color":"from-amber-500 to-orange-500",
   "contents":["Programme list","Rank trends","Fee & scholarship info","Choice-filling checklist"]}')
on conflict (slug) do nothing;

-- ---------- Previous year papers ----------
insert into public.products (title, slug, description, category, price, original_price, file_path, sort_order, details) values
('VITEEE 2026 Paper (Memory-based)', 'viteee-2026-paper', 'Memory-based questions with step-by-step solutions.',
 'previous_paper', 199, null, 'previous-papers/viteee-2026.pdf', 1, '{"questions_count":125,"duration_label":"150 min"}'),
('VITEEE 2025 Paper (Memory-based)', 'viteee-2025-paper', 'Memory-based questions with step-by-step solutions.',
 'previous_paper', 199, null, 'previous-papers/viteee-2025.pdf', 2, '{"questions_count":125,"duration_label":"150 min"}'),
('VITEEE 2024 Paper (Memory-based)', 'viteee-2024-paper', 'Memory-based questions with step-by-step solutions.',
 'previous_paper', 199, null, 'previous-papers/viteee-2024.pdf', 3, '{"questions_count":125,"duration_label":"150 min"}'),
('Last 5 Years Paper Bundle', 'last-5-years-paper-bundle', 'All five papers with solutions and topic-wise analysis.',
 'previous_paper', 699, 995, 'previous-papers/last-5-years-bundle.pdf', 4, '{"badge":"Save 30%","questions_count":625,"duration_label":"150 min each"}')
on conflict (slug) do nothing;

-- ---------- Mock tests & MCQ practice ----------
insert into public.products (title, slug, description, category, price, original_price, is_free, sort_order, details) values
('Free VITEEE Sample Test', 'free-viteee-sample-test', 'A short sample test to try our test format right now.',
 'mock_test', 0, null, true, 1, '{"badge":"Free","test_type":"mock","questions_count":5,"duration_label":"10 min"}'),
('Mock Test Pack – 10 Tests', 'mock-test-pack-10', '10 full-length tests in the latest VITEEE pattern with solutions.',
 'mock_test', 999, 1499, false, 2, '{"test_type":"mock","questions_count":125,"duration_label":"150 min each"}'),
('Mock Test Pack – 25 Tests', 'mock-test-pack-25', '25 full-length tests, all-India ranking and detailed performance reports.',
 'mock_test', 1499, 2499, false, 3, '{"badge":"Best Value","test_type":"mock","questions_count":125,"duration_label":"150 min each"}'),
('Maths Chapter-wise MCQs', 'maths-chapter-wise-mcqs', '1,500+ MCQs sorted by chapter and difficulty.',
 'mock_test', 399, null, false, 4, '{"test_type":"mcq","questions_count":1500,"duration_label":"Self-paced"}'),
('Physics Chapter-wise MCQs', 'physics-chapter-wise-mcqs', '1,200+ MCQs with short explanations.',
 'mock_test', 399, null, false, 5, '{"test_type":"mcq","questions_count":1200,"duration_label":"Self-paced"}'),
('Chemistry Chapter-wise MCQs', 'chemistry-chapter-wise-mcqs', '1,200+ MCQs covering physical, organic & inorganic.',
 'mock_test', 399, null, false, 6, '{"test_type":"mcq","questions_count":1200,"duration_label":"Self-paced"}')
on conflict (slug) do nothing;

-- ---------- One free sample test with 5 questions ----------
insert into public.tests (id, product_id, title, type, duration_minutes, is_free)
select '00000000-0000-4000-8000-000000000001', p.id, 'Free VITEEE Sample Test', 'mock', 10, true
from public.products p where p.slug = 'free-viteee-sample-test'
on conflict (id) do nothing;

insert into public.questions (id, test_id, question, options, correct_option, explanation, marks, sort_order) values
('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001',
 'What is the derivative of x² at x = 3?', '["3","6","9","12"]', 1,
 'd/dx (x²) = 2x, so at x = 3 it is 2 × 3 = 6.', 1, 1),
('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001',
 'If log₁₀ x = 2, what is x?', '["20","100","1000","10"]', 1,
 'log₁₀ x = 2 means x = 10² = 100.', 1, 2),
('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001',
 'What is the SI unit of electric charge?', '["Ampere","Volt","Coulomb","Ohm"]', 2,
 'Electric charge is measured in coulombs (C).', 1, 3),
('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001',
 'What is the pH of pure water at 25 °C?', '["0","5","7","14"]', 2,
 'Pure water is neutral, so its pH is 7 at 25 °C.', 1, 4),
('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001',
 'Choose the word closest in meaning to ''ABUNDANT''.', '["Scarce","Plentiful","Tiny","Empty"]', 1,
 'Abundant means existing in large quantities — plentiful.', 1, 5)
on conflict (id) do nothing;

-- ---------- Counselling slots for the next 7 days (3 per day) ----------
insert into public.slots (date, start_time, end_time, price)
select d::date, t.start_time, t.end_time, 999
from generate_series(current_date + 1, current_date + 7, interval '1 day') as d
cross join (values ('10:00'::time, '10:45'::time), ('15:00'::time, '15:45'::time), ('18:30'::time, '19:15'::time))
  as t (start_time, end_time)
where extract(isodow from d) <> 7   -- no Sunday slots
on conflict (date, start_time) do nothing;

-- ---------- Sample reviews (REPLACE with real ones!) ----------
insert into public.reviews (name, type, rating, comment, is_approved)
select * from (values
  ('Sample Student 1', 'student', 5::smallint, 'SAMPLE REVIEW — replace with a real student''s words. The mock tests felt just like the real exam.', true),
  ('Sample Student 2', 'student', 5::smallint, 'SAMPLE REVIEW — replace with a real student''s words. The counselling call helped me choose the right branch.', true),
  ('Sample Student 3', 'student', 4::smallint, 'SAMPLE REVIEW — replace with a real student''s words. Notes were short and clear.', true),
  ('Sample Parent 1',  'parent',  5::smallint, 'SAMPLE REVIEW — replace with a real parent''s words. The fee categories were explained clearly.', true),
  ('Sample Parent 2',  'parent',  5::smallint, 'SAMPLE REVIEW — replace with a real parent''s words. We felt confident during counselling.', true),
  ('Sample Parent 3',  'parent',  4::smallint, 'SAMPLE REVIEW — replace with a real parent''s words. Regular updates helped us a lot.', true)
) as v (name, type, rating, comment, is_approved)
where not exists (select 1 from public.reviews where name like 'Sample %');

-- =====================================================================
-- DONE! 🎉  To make YOURSELF an admin (after you sign up on the website):
--   update public.profiles set role = 'admin' where phone = '91XXXXXXXXXX';
--   (or use: where email = 'the email you log in with')
-- =====================================================================
