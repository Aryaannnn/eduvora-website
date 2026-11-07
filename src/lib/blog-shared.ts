// Blog bits shared by the website and the admin editor (safe in the browser).
export const BLOG_CATEGORIES = ["preparation", "counselling", "colleges", "updates"] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export const CATEGORY_NAME: Record<BlogCategory, string> = {
  preparation: "Preparation",
  counselling: "Counselling",
  colleges: "Colleges",
  updates: "Updates",
};

export const CATEGORY_STYLE: Record<BlogCategory, string> = {
  preparation: "bg-sky-50 text-sky-700 ring-sky-200",
  counselling: "bg-amber-50 text-amber-800 ring-amber-200",
  colleges: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  updates: "bg-rose-50 text-rose-700 ring-rose-200",
};

/** "How to choose a VIT campus?" → "how-to-choose-a-vit-campus" */
export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100).replace(/-+$/, "");
}

/** About 200 words a minute. */
export function readingMinutes(html: string) {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.min(120, Math.round(words / 200)));
}
