// =====================================================================
//  BLOG (server) — published posts for /blog and /blog/<slug>
//  Posts are written in Admin → Blog (supabase/blog.sql).
//  🔒 Article HTML is cleaned with an allow-list (cleanArticleHtml) when it
//     is saved AND again when it is shown, so no scripts can ever run.
// =====================================================================
import "server-only";
import sanitizeHtml from "sanitize-html";
import { cacheLife, cacheTag } from "next/cache";
import { slugify, type BlogCategory } from "./blog-shared";
import { getPublicSupabase } from "./supabase/public";

export type BlogPostSummary = {
  id: string; slug: string; title: string; excerpt: string | null; category: BlogCategory; cover_image_url: string | null;
  author_name: string; reading_minutes: number; published_at: string; updated_at: string; is_sample: boolean;
};
export type BlogPost = BlogPostSummary & { content_html: string; seo_title: string | null; seo_description: string | null };
export type TocItem = { id: string; text: string; level: 2 | 3 };

const SUMMARY = "id,slug,title,excerpt,category,cover_image_url,author_name,reading_minutes,published_at,updated_at,is_sample";

/** All published posts, newest first (cached; refreshed when the admin saves). */
export async function getPublishedPosts(): Promise<BlogPostSummary[]> {
  "use cache";
  cacheTag("blog");
  const supabase = getPublicSupabase();
  if (!supabase) return (cacheLife("minutes"), []);
  const { data, error } = await supabase.from("blog_posts").select(SUMMARY).eq("status", "published").order("published_at", { ascending: false }).limit(500);
  if (error) {
    console.warn("Supabase blog_posts:", error.message, "(run supabase/blog.sql?)");
    cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
    return [];
  }
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 }); // scheduled posts appear within ~15 min
  return (data ?? []) as BlogPostSummary[];
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  "use cache";
  cacheTag("blog");
  const supabase = getPublicSupabase();
  if (!supabase || !/^[a-z0-9-]{1,100}$/.test(slug)) return (cacheLife("minutes"), null);
  const { data, error } = await supabase.from("blog_posts").select(`${SUMMARY},content_html,seo_title,seo_description`).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) {
    cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
    return null;
  }
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  return (data as BlogPost | null) ?? null;
}

// ---------------------------------------------------------------- safe HTML
const SAFE: sanitizeHtml.IOptions = {
  allowedTags: ["h2", "h3", "h4", "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "code", "pre", "img", "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  transformTags: {
    // external links open in a new tab, safely
    a: (_tag, attribs) => {
      const href = attribs.href ?? "#";
      const external = /^https?:/i.test(href);
      const out: Record<string, string> = external ? { href, target: "_blank", rel: "noopener noreferrer" } : { href };
      return { tagName: "a", attribs: out };
    },
    h1: "h2", // only one H1 per page (the title)
  },
  // pictures must be full https:// links (uploaded pictures always are)
  exclusiveFilter: (frame) => frame.tag === "img" && !/^https:\/\//i.test(frame.attribs.src ?? ""),
};

/** Allow-list cleaning: removes scripts, styles, event handlers and unsafe links. */
export function cleanArticleHtml(html: string): string {
  return sanitizeHtml(html, SAFE).trim();
}

/** Adds ids to H2/H3 headings and returns the table of contents. */
export function withHeadingIds(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, lvl: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
    let id = slugify(text) || "section";
    for (let n = 2; used.has(id); n++) id = `${slugify(text) || "section"}-${n}`;
    used.add(id);
    if (text) toc.push({ id, text, level: lvl === "2" ? 2 : 3 });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
  return { html: out, toc };
}

/** Related posts: same category first, then the newest others. */
export function relatedPosts(all: BlogPostSummary[], post: Pick<BlogPostSummary, "id" | "category">, n = 3) {
  const others = all.filter((p) => p.id !== post.id);
  return [...others.filter((p) => p.category === post.category), ...others.filter((p) => p.category !== post.category)].slice(0, n);
}
