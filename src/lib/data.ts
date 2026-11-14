// =====================================================================
//  PUBLIC DATA FROM SUPABASE (products, slots, reviews, predictor)
//  Results are cached for a few minutes so the website stays fast.
//  Admin changes refresh them instantly (updateTag in admin actions).
//  If Supabase has a problem, we show an empty list and RETRY after
//  about 30 seconds — the website never crashes because of it.
// =====================================================================
import { applyPriceLabels } from "./price-labels";
import { cacheLife, cacheTag } from "next/cache";
import { todayInIndia } from "./format";
import { getPublicSupabase } from "./supabase/public";
import { hiddenSample, productsWithoutSamples } from "./sample";
import type { Product, ProductCategory, Review, SiteStat, Slot } from "./types";

// content_links is private, so we always list the public columns by name
export const PRODUCT_COLUMNS =
  "id,title,slug,description,category,college,price,original_price,is_free,thumbnail_url,file_path,details";
const TEST_COLUMNS = "tests(id,title,type,is_free,duration_minutes,total_marks)";

// Cache lifetimes: normal results vs. "something went wrong, try again soon"
const ok = () => cacheLife("minutes");
const retrySoon = (label: string, message: string) => {
  // A warning (not an error): the page still works and simply shows empty data.
  // (console.error here made the dev server reload pages in a loop.)
  const hint = message.includes("schema cache") ? " → run the matching SQL file in Supabase (see SUPABASE_SETUP.md)" : "";
  console.warn(`Supabase ${label}: ${message}${hint}`);
  // Server retries after 30 s. ("stale" ≥ 5 min keeps the page loading instantly.)
  cacheLife({ stale: 300, revalidate: 30, expire: 3600 });
};

export async function getProducts(category: ProductCategory): Promise<Product[]> {
  "use cache";
  cacheTag("products", "settings"); // "settings": the original-price switch
  const supabase = getPublicSupabase();
  if (!supabase) return (ok(), []);
  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_COLUMNS},${TEST_COLUMNS}`)
    .eq("category", category)
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  if (error) return (retrySoon("getProducts", error.message), []);
  ok();
  return applyPriceLabels(productsWithoutSamples((data ?? []) as unknown as Product[])); // SAMPLE items hidden once Live
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  "use cache";
  cacheTag("products", "settings");
  const supabase = getPublicSupabase();
  if (!supabase) return (ok(), null);
  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_COLUMNS},${TEST_COLUMNS}`)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return (retrySoon("getProductBySlug", error.message), null);
  ok();
  const p = (data as unknown as Product) ?? null;
  if (!p || hiddenSample(p.title)) return null; // SAMPLE item once Live → "not found"
  return (await applyPriceLabels(productsWithoutSamples([p])))[0];
}

export async function getUpcomingSlots(limit = 8): Promise<Slot[]> {
  "use cache";
  cacheTag("slots");
  const supabase = getPublicSupabase();
  if (!supabase) return (ok(), []);
  const { data, error } = await supabase
    .from("slots")
    .select("id,date,start_time,end_time,price")
    .eq("is_available", true)
    .gte("date", todayInIndia())
    .order("date")
    .order("start_time")
    .limit(limit);
  if (error) return (retrySoon("getUpcomingSlots", error.message), []);
  ok();
  return (data ?? []) as Slot[];
}

export async function getApprovedReviews(): Promise<Review[]> {
  "use cache";
  cacheTag("reviews");
  const supabase = getPublicSupabase();
  if (!supabase) return (ok(), []);
  const cols = "id,name,type,rating,comment,photo_url";
  const first = await supabase.from("reviews").select(`${cols},is_verified`).eq("is_approved", true).order("created_at", { ascending: false });
  let data = first.data as Review[] | null;
  let error = first.error;
  // Before supabase/stats-reviews.sql is run there is no is_verified column yet
  if (error && /is_verified/.test(error.message)) {
    const again = await supabase.from("reviews").select(cols).eq("is_approved", true).order("created_at", { ascending: false });
    data = again.data as Review[] | null;
    error = again.error;
  }
  if (error) return (retrySoon("getApprovedReviews", error.message), []);
  ok();
  return (data ?? []) as Review[];
}

/** "Our results" numbers (Admin → Settings). Only stats WITH a number are returned. */
export async function getSiteStats(): Promise<SiteStat[]> {
  "use cache";
  cacheTag("settings");
  const supabase = getPublicSupabase();
  if (!supabase) return (ok(), []);
  const { data, error } = await supabase.from("site_stats").select("id,label,value,suffix,sort_order").order("sort_order");
  if (error) return (retrySoon("getSiteStats", error.message), []);
  ok();
  return ((data ?? []) as SiteStat[]).filter((s) => s.value !== null && s.label.trim());
}

// Rank & College Predictor data is PRIVATE (server only; the college list is for paid counselling) —
// it is loaded on the server in src/lib/predictor-server.ts

// ---------------------------------------------------------------- REVIEW SUMMARY
/** Average rating + counts from APPROVED reviews only (reviews page, "Rating: x/5" lines). */
export async function getReviewSummary(): Promise<{ avg: number; count: number; verified: number }> {
  const reviews = await getApprovedReviews();
  const count = reviews.length;
  const avg = count ? Math.round((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / count) * 10) / 10 : 0;
  return { avg, count, verified: reviews.filter((r) => r.is_verified).length };
}

// ---------------------------------------------------------------- SUCCESS STORIES
// Real students only, added in Admin → Success Stories with their consent (supabase/success-stories.sql).
export type SuccessStory = { id: string; student_name: string; year: number | null; achievement: string; quote: string; photo_url: string | null; video_url: string | null };

export async function getSuccessStories(): Promise<SuccessStory[]> {
  "use cache";
  cacheTag("reviews");
  const supabase = getPublicSupabase();
  if (!supabase) return (ok(), []);
  const { data, error } = await supabase
    .from("success_stories")
    .select("id,student_name,year,achievement,quote,photo_url,video_url")
    .eq("is_published", true)
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return (retrySoon("getSuccessStories", error.message), []);
  ok();
  return (data ?? []) as SuccessStory[];
}

// ---------------------------------------------------------------- VIDEO TESTIMONIALS
// Only videos with the student's consent confirmed (supabase/video-testimonials.sql).
export type VideoTestimonial = { id: string; youtube_id: string; student_name: string; achievement: string | null; year: number | null };

export async function getVideoTestimonials(): Promise<VideoTestimonial[]> {
  "use cache";
  cacheTag("reviews");
  const supabase = getPublicSupabase();
  if (!supabase) return (ok(), []);
  const { data, error } = await supabase
    .from("video_testimonials")
    .select("id,youtube_id,student_name,achievement,year")
    .eq("is_published", true)
    .eq("consent_confirmed", true)
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) return (retrySoon("getVideoTestimonials", error.message), []);
  ok();
  return (data ?? []) as VideoTestimonial[];
}
