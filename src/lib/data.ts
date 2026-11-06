// =====================================================================
//  PUBLIC DATA FROM SUPABASE (products, slots, reviews, predictor)
//  Results are cached for a few minutes so the website stays fast.
//  Admin changes refresh them instantly (updateTag in admin actions).
//  If Supabase has a problem, we show an empty list and RETRY after
//  about 30 seconds — the website never crashes because of it.
// =====================================================================
import { cacheLife, cacheTag } from "next/cache";
import { todayInIndia } from "./format";
import { getPublicSupabase } from "./supabase/public";
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
  cacheTag("products");
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
  return (data ?? []) as unknown as Product[];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  "use cache";
  cacheTag("products");
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
  return (data as unknown as Product) ?? null;
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

// Rank & College Predictor data is PRIVATE now (paid counselling only) —
// it is loaded on the server in src/lib/predictor-server.ts
