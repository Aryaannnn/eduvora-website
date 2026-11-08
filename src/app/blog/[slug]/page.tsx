import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import { Suspense } from "react";
import { CategoryBadge, Cover } from "@/components/blog/PostCard";
import PostCard from "@/components/blog/PostCard";
import { CalendarIcon, CheckIcon, ClockIcon, HomeIcon, UserIcon } from "@/components/Icons";
import { siteConfig } from "@/config/site";
import { cleanArticleHtml, getPostBySlug, getPublishedPosts, relatedPosts, withHeadingIds } from "@/lib/blog";
import { CATEGORY_NAME } from "@/lib/blog-shared";
import { formatDayIST } from "@/lib/format";
import { SITE_URL } from "@/lib/site-url";

export async function generateMetadata(props: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Article not found", robots: { index: false } };
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt || `${post.title} — ${siteConfig.businessName} blog.`;
  return {
    title: { absolute: `${title} | ${siteConfig.businessName}` },
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    ...(post.is_sample ? { robots: { index: false, follow: true } } : {}), // sample posts are design previews — never in Google
    authors: [{ name: post.author_name }],
    // the share picture comes from ./opengraph-image.tsx (cover + title)
    openGraph: { type: "article", title, description, publishedTime: post.published_at, modifiedTime: post.updated_at, authors: [post.author_name], section: CATEGORY_NAME[post.category] },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function BlogPostPage(props: PageProps<"/blog/[slug]">) {
  return (
    <Suspense fallback={<div className="hero-bg h-72" aria-busy="true" />}>
      <Post params={props.params} />
    </Suspense>
  );
}

async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const { html, toc } = withHeadingIds(cleanArticleHtml(post.content_html)); // cleaned again before showing
  const related = relatedPosts(await getPublishedPosts(), post);
  const founderFirst = siteConfig.founder.name.split(" ")[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seo_description || post.excerpt || undefined,
    image: post.cover_image_url || `${SITE_URL}/blog/${post.slug}/opengraph-image`,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: { "@type": "Person", name: post.author_name },
    publisher: { "@type": "Organization", name: siteConfig.businessName, logo: { "@type": "ImageObject", url: `${SITE_URL}/logo-compact.png` } },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  return (
    <>
      <JsonLd data={[jsonLd, breadcrumbLd([{ name: "Blog", path: "/blog" }, { name: post.title, path: `/blog/${post.slug}` }])]} />
      {/* ---------- Header ---------- */}
      <header className="hero-bg relative overflow-hidden">
        <div className="grid-pattern absolute inset-0" aria-hidden />
        <div className="container-page relative max-w-4xl pb-10 pt-8 text-white sm:pb-14 sm:pt-10">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Link href="/" className="inline-flex items-center gap-1 hover:text-white"><HomeIcon className="h-3.5 w-3.5" /> Home</Link>
            <span aria-hidden>›</span>
            <Link href="/blog" className="hover:text-white">Blog</Link>
            <span aria-hidden>›</span>
            <Link href={`/blog?category=${post.category}`} className="hover:text-white">{CATEGORY_NAME[post.category]}</Link>
          </nav>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <CategoryBadge category={post.category} />
            {post.is_sample && <span className="rounded-full bg-rose-500 px-2.5 py-1 text-xs font-extrabold text-white">SAMPLE POST</span>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight [text-wrap:balance] sm:text-5xl">{post.title}</h1>
          {post.excerpt && <p className="mt-4 max-w-2xl text-lg text-slate-200">{post.excerpt}</p>}
          <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-200">
            <span className="inline-flex items-center gap-1.5"><UserIcon className="h-4 w-4 text-accent-300" /> {post.author_name}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarIcon className="h-4 w-4 text-accent-300" /> {formatDayIST(post.published_at)}</span>
            <span className="inline-flex items-center gap-1.5"><ClockIcon className="h-4 w-4 text-accent-300" /> {post.reading_minutes} min read</span>
          </p>
        </div>
      </header>

      <div className="container-page max-w-6xl py-10 sm:py-14">
        {post.cover_image_url && (
          <div className="mx-auto -mt-4 mb-10 max-w-4xl overflow-hidden rounded-3xl shadow-xl ring-1 ring-slate-200 sm:-mt-8">
            <Cover src={post.cover_image_url} title={post.title} sizes="(min-width: 1024px) 56rem, 100vw" priority />
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-[1fr_16rem]">
          <div className="min-w-0">
            {post.is_sample && (
              <p className="mb-6 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800 ring-1 ring-rose-200">This is a SAMPLE post to show the design. It contains no real information.</p>
            )}

            {/* Table of contents (phones) */}
            {toc.length > 1 && (
              <details className="mb-8 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 lg:hidden">
                <summary className="cursor-pointer font-extrabold text-slate-900">Table of contents</summary>
                <TocList toc={toc} />
              </details>
            )}

            <article className="article max-w-3xl" dangerouslySetInnerHTML={{ __html: html }} />

            {/* ---------- Book counselling ---------- */}
            <section className="mt-14 max-w-3xl overflow-hidden rounded-3xl bg-brand-700 p-6 text-white shadow-xl shadow-brand-900/20 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent-300">Need personal guidance?</p>
              <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Book a counselling session with {founderFirst} Sir</h2>
              <ul className="mt-4 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
                {["Campus & branch plan for your rank", "Fee category guidance", "Choice filling help", "Parents are welcome to join"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><CheckIcon className="h-4 w-4 text-accent-300" /> {t}</li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/book-a-slot" className="btn-accent !px-6 !py-3.5 text-base">Book Counselling</Link>
                <Link href="/predictor" className="btn-outline !py-3.5">Try the Free Rank Predictor</Link>
              </div>
            </section>
          </div>

          {/* Table of contents (desktop) */}
          {toc.length > 1 && (
            <aside className="hidden lg:block">
              <nav aria-label="Table of contents" className="sticky top-24 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">In this article</p>
                <TocList toc={toc} />
              </nav>
            </aside>
          )}
        </div>

        {/* ---------- Related posts ---------- */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-extrabold text-brand-700">Related articles</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => <PostCard key={p.slug} post={p} />)}
            </div>
          </section>
        )}
        <p className="mt-10 text-center"><Link href="/blog" className="font-semibold text-brand-700 hover:underline">← All articles</Link></p>
      </div>
    </>
  );
}

function TocList({ toc }: { toc: { id: string; text: string; level: 2 | 3 }[] }) {
  return (
    <ol className="mt-3 space-y-2 text-sm">
      {toc.map((t) => (
        <li key={t.id} className={t.level === 3 ? "pl-4" : ""}>
          <a href={`#${t.id}`} className={`block leading-snug hover:text-brand-600 ${t.level === 2 ? "font-semibold text-slate-800" : "text-slate-600"}`}>{t.text}</a>
        </li>
      ))}
    </ol>
  );
}
