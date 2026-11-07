-- =====================================================================
--  PARENT PROGRESS LINK ("Share with Parent")
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Run after setup.sql, predictor.sql and test-analytics.sql.)
--
--  • A student creates ONE private link: /parent/<long random secret>.
--  • Only a SHA-256 fingerprint of the secret is stored — never the secret
--    itself — so even a copy of the database can't open a parent page.
--  • Links expire after 90 days; the student can renew (new secret, old
--    link stops working) or turn it off any time.
--  • parent_view() returns a READ-ONLY summary: name, counselling sessions,
--    purchased courses, test scores and the latest predicted rank.
--    NO payment amounts, NO phone/email, NO way to change anything.
-- =====================================================================

create table if not exists public.parent_shares (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users (id) on delete cascade, -- account deleted → link deleted
  token_hash      text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  parent_email    text check (parent_email is null or (char_length(parent_email) <= 120 and parent_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  last_viewed_at  timestamptz,
  view_count      integer not null default 0
);

alter table public.parent_shares enable row level security;
drop policy if exists "parent shares: read own" on public.parent_shares;
create policy "parent shares: read own" on public.parent_shares
  for select to authenticated using (user_id = auth.uid());
-- No insert/update/delete policies: changes only through the functions below.
revoke all on table public.parent_shares from anon;
revoke insert, update, delete on table public.parent_shares from authenticated;

-- ---------------------------------------------------------------------
-- Student: create or renew the link (the website makes the secret and
-- sends only its fingerprint). Valid for 90 days.
-- ---------------------------------------------------------------------
create or replace function public.parent_share_create(p_token_hash text, p_parent_email text default null)
returns public.parent_shares
language plpgsql security definer set search_path = public
as $$
declare r public.parent_shares;
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid link.'; end if;
  insert into public.parent_shares (user_id, token_hash, parent_email, created_at, expires_at, revoked_at, last_viewed_at, view_count)
  values (auth.uid(), p_token_hash, nullif(btrim(p_parent_email), ''), now(), now() + interval '90 days', null, null, 0)
  on conflict (user_id) do update
    set token_hash = excluded.token_hash,
        parent_email = coalesce(excluded.parent_email, public.parent_shares.parent_email),
        created_at = now(), expires_at = now() + interval '90 days',
        revoked_at = null, last_viewed_at = null, view_count = 0
  returning * into r;
  return r;
end;
$$;

-- Student: turn the link off
create or replace function public.parent_share_revoke()
returns void
language sql security definer set search_path = public
as $$
  update public.parent_shares set revoked_at = now() where user_id = auth.uid() and revoked_at is null;
$$;

revoke all on function public.parent_share_create(text, text), public.parent_share_revoke() from public, anon;
grant execute on function public.parent_share_create(text, text), public.parent_share_revoke() to authenticated;

-- ---------------------------------------------------------------------
-- Parent page (no login): secret → read-only summary, or null when the
-- link is wrong, turned off or expired.
-- ---------------------------------------------------------------------
create or replace function public.parent_view(p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  sh public.parent_shares;
  uid uuid;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then return null; end if;
  select * into sh from public.parent_shares
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     and revoked_at is null and expires_at > now();
  if not found then return null; end if;
  uid := sh.user_id;
  update public.parent_shares set last_viewed_at = now(), view_count = view_count + 1 where id = sh.id;

  return jsonb_build_object(
    'student_name', coalesce((select nullif(btrim(full_name), '') from public.profiles where id = uid), 'Student'),
    'expires_at', sh.expires_at,
    -- Counselling sessions: date, time and status only
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('date', s.date, 'start_time', s.start_time, 'end_time', s.end_time, 'status', b.status)
                       order by s.date desc, s.start_time desc)
        from public.bookings b join public.slots s on s.id = b.slot_id
       where b.user_id = uid and b.status in ('pending', 'confirmed', 'completed')), '[]'::jsonb),
    -- Courses & material: titles only (no prices or payment details)
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object('title', p.title, 'category', p.category, 'since', pu.created_at) order by pu.created_at desc)
        from public.purchases pu join public.products p on p.id = pu.product_id
       where pu.user_id = uid and pu.status = 'paid'), '[]'::jsonb),
    -- Test scores (oldest first, for the chart)
    'tests', coalesce((
      select jsonb_agg(x order by (x ->> 'submitted_at'))
        from (
          select jsonb_build_object(
                   'title', t.title, 'score', a.score, 'submitted_at', a.submitted_at,
                   'total_marks', (select coalesce(sum(q.marks), 0) from public.questions q where q.test_id = a.test_id)) as x
            from public.test_attempts a join public.tests t on t.id = a.test_id
           where a.user_id = uid and a.submitted_at is not null
           order by a.submitted_at desc
           limit 100
        ) z), '[]'::jsonb),
    -- Latest rank prediction
    'prediction', (
      select jsonb_build_object('min_rank', predicted_min_rank, 'max_rank', predicted_max_rank, 'entered_rank', entered_rank, 'at', created_at)
        from public.predictions where user_id = uid order by created_at desc limit 1)
  );
end;
$$;
revoke all on function public.parent_view(text) from public;
grant execute on function public.parent_view(text) to anon, authenticated;
