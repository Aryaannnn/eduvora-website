-- =====================================================================
--  VIT COUNSELLING GUIDE (/vit-counselling-guide) — Admin → Settings → "VIT Counselling Guide"
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  One settings row holding the guide's text (sections, FAQs, the year and the date
--  you last checked the facts on the official VIT website).
--  Empty at first → the website shows the starting text from the code, with
--  [[FILL: …]] placeholders for dates, fees and ranks. Save once in the admin
--  panel to store your own version.
--  Everyone can READ it (the public page needs it); only admins can change it.
-- =====================================================================
create table if not exists public.vit_guide_settings (
  id          integer primary key default 1 check (id = 1),
  content     jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);
insert into public.vit_guide_settings (id) values (1) on conflict (id) do nothing;

alter table public.vit_guide_settings enable row level security;
drop policy if exists "vit guide: anyone reads" on public.vit_guide_settings;
drop policy if exists "vit guide: admin updates" on public.vit_guide_settings;
create policy "vit guide: anyone reads" on public.vit_guide_settings
  for select to anon, authenticated using (true);
create policy "vit guide: admin updates" on public.vit_guide_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.vit_guide_settings from anon, authenticated;
revoke update on public.vit_guide_settings from anon;

create or replace function public.before_vit_guide_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.id := 1;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
drop trigger if exists before_vit_guide_update on public.vit_guide_settings;
create trigger before_vit_guide_update before update on public.vit_guide_settings
  for each row execute function public.before_vit_guide_update();

select id, content is not null as has_saved_text, updated_at from public.vit_guide_settings;
