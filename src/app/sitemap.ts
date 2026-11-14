// /sitemap.xml — tells Google which PUBLIC pages exist: main pages, every course
// page and every published blog post (sample posts excluded).
// Private pages (dashboard, admin, parent links, payments, login, invoices) are
// never listed — they also say "noindex".
// While PRE_LAUNCH is on, pages still say "noindex", so nothing is shown in Google yet.
import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog";
import { getProducts } from "@/lib/data";
import { SITE_URL } from "@/lib/site-url";

const STATIC = [
  "", "/courses", "/study-material", "/mock-tests", "/previous-year-papers", "/free-resources", "/predictor", "/book-a-slot",
  "/important-dates", "/fee-calculator", "/blog", "/reviews", "/about", "/founder", "/parents", "/contact", "/privacy-policy", "/terms-and-conditions", "/refund-policy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, courses] = await Promise.all([getPublishedPosts(), getProducts("crash_course")]);
  return [
    ...STATIC.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: (p === "" || p === "/blog" || p === "/important-dates" ? "daily" : "weekly") as "daily" | "weekly", priority: p === "" ? 1 : p === "/blog" ? 0.8 : 0.6 })),
    ...courses.map((c) => ({ url: `${SITE_URL}/courses/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...posts.filter((p) => !p.is_sample).map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updated_at, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
