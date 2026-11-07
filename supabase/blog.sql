-- =====================================================================
--  EDUVORA — BLOG
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE file
--  → Run. Safe to run again.
--
--  • blog_posts: articles written in Admin → Blog (draft or published).
--    Visitors only ever see PUBLISHED posts.
--  • 'blog-images' storage bucket (public): cover pictures and pictures
--    inside articles. Only admins can upload.
--  • ONE clearly marked SAMPLE post is added (no real facts) so you can
--    see the design — delete it once you publish your own posts.
-- =====================================================================

create table if not exists public.blog_posts (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  title             text not null check (char_length(title) between 3 and 160),
  excerpt           text check (excerpt is null or char_length(excerpt) <= 300),        -- short summary on the blog list
  category          text not null default 'preparation' check (category in ('preparation', 'counselling', 'colleges', 'updates')),
  cover_image_url   text check (cover_image_url is null or cover_image_url ~ '^https://'),
  content_html      text not null default '',                                          -- cleaned on the server before saving
  seo_title         text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description   text check (seo_description is null or char_length(seo_description) <= 170),
  author_name       text not null default 'Utkarsh Shrivastava',
  reading_minutes   integer not null default 1 check (reading_minutes between 1 and 120),
  status            text not null default 'draft' check (status in ('draft', 'published')),
  published_at      timestamptz,
  is_sample         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists blog_posts_pub_idx on public.blog_posts (status, published_at desc);

alter table public.blog_posts enable row level security;
drop policy if exists "blog: anyone reads published" on public.blog_posts;
drop policy if exists "blog: admin all"              on public.blog_posts;
create policy "blog: anyone reads published" on public.blog_posts
  for select to anon, authenticated using ((status = 'published' and published_at <= now()) or public.is_admin());
create policy "blog: admin all" on public.blog_posts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Pictures (public bucket; admins upload) ----------
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update set public = true;

drop policy if exists "blog images: anyone views"    on storage.objects;
drop policy if exists "blog images: admin upload"    on storage.objects;
drop policy if exists "blog images: admin update"    on storage.objects;
drop policy if exists "blog images: admin delete"    on storage.objects;
create policy "blog images: anyone views" on storage.objects
  for select to anon, authenticated using (bucket_id = 'blog-images');
create policy "blog images: admin upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'blog-images' and public.is_admin());
create policy "blog images: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'blog-images' and public.is_admin());
create policy "blog images: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'blog-images' and public.is_admin());

-- ---------- ONE sample post (design preview only — no real facts) ----------
insert into public.blog_posts (slug, title, excerpt, category, content_html, seo_title, seo_description, reading_minutes, status, published_at, is_sample)
select
  'sample-post-design-preview',
  'SAMPLE — Blog post design preview',
  'This is a SAMPLE post that only shows how an article looks. It contains no real information. Delete it in Admin → Blog.',
  'updates',
  '<p><strong>This is a SAMPLE post.</strong> It only shows the design of an article page. Nothing written here is real advice or information — replace it with your own articles in Admin → Blog, then delete this post.</p>'
  || '<h2>A main heading looks like this</h2><p>Paragraphs of normal text appear like this. You can make words <strong>bold</strong> or <em>italic</em>, and add <a href="https://vit.ac.in" target="_blank" rel="noopener noreferrer">a link to an official page</a>.</p>'
  || '<h3>A smaller heading looks like this</h3><p>Headings automatically appear in the table of contents at the top of the article.</p>'
  || '<h2>Lists</h2><ul><li>A bullet point</li><li>Another bullet point</li><li>A third bullet point</li></ul><ol><li>A numbered step</li><li>Another numbered step</li></ol>'
  || '<h2>Tables</h2><table><tbody><tr><th>Column A</th><th>Column B</th><th>Column C</th></tr><tr><td>Sample</td><td>Sample</td><td>Sample</td></tr><tr><td>Sample</td><td>Sample</td><td>Sample</td></tr></tbody></table>'
  || '<h2>Quotes</h2><blockquote><p>A highlighted quote or tip appears like this.</p></blockquote><p>At the end of every post, readers see a “Book Counselling” box and links to related posts.</p>',
  'SAMPLE — Blog post design preview',
  'A SAMPLE post that shows the EDUVORA blog design. Not real information.',
  1, 'published', now(), true
where not exists (select 1 from public.blog_posts where is_sample);
