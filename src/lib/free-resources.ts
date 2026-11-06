// =====================================================================
//  FREE RESOURCES
//  • Free items = products the admin marked "Free" (is_free) + free tests.
//  • Students must LOG IN to use them. Getting a free item saves a ₹0
//    "paid" purchase, so it shows in My Courses & Material and the admin
//    sees it in Admin → Students ("Free items").
// =====================================================================
import { cacheLife, cacheTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_COLUMNS } from "./data";
import { getPublicSupabase } from "./supabase/public";
import type { Product, ProductCategory } from "./types";

export type FreeTest = { id: string; title: string; type: "mock" | "mcq"; duration_minutes: number; total_marks: number };
export type FreeResources = { products: Product[]; tests: FreeTest[] };

/** Public list for the home page and /free-resources (cached, no private data). */
export async function getFreeResources(): Promise<FreeResources> {
  "use cache";
  cacheTag("products");
  const supabase = getPublicSupabase();
  if (!supabase) return (cacheLife("minutes"), { products: [], tests: [] });
  const [products, tests] = await Promise.all([
    supabase
      .from("products")
      .select(`${PRODUCT_COLUMNS},tests(id,title,type,is_free,duration_minutes,total_marks)`)
      .eq("is_free", true)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
    // Free tests that are NOT inside a free product (those are covered by the product)
    supabase.from("tests").select("id,title,type,duration_minutes,total_marks,product_id,products(is_free)").eq("is_free", true).eq("is_active", true).order("created_at"),
  ]);
  if (products.error || tests.error) {
    console.warn("Supabase getFreeResources:", (products.error ?? tests.error)?.message);
    cacheLife({ stale: 300, revalidate: 30, expire: 3600 });
  } else {
    cacheLife("minutes");
  }
  const standalone = ((tests.data ?? []) as unknown as (FreeTest & { product_id: string | null; products: { is_free: boolean } | null })[])
    .filter((t) => !t.products?.is_free)
    .map(({ id, title, type, duration_minutes, total_marks }) => ({ id, title, type, duration_minutes, total_marks }));
  return { products: (products.data ?? []) as unknown as Product[], tests: standalone };
}

/**
 * Unlocks a FREE product for a student (server only, service-role client).
 * Saves a ₹0 'paid' purchase once. Returns the purchase id, or null on error.
 */
export async function unlockFreeProduct(db: SupabaseClient, userId: string, productId: string): Promise<string | null> {
  const { data: owned } = await db.from("purchases").select("id").eq("user_id", userId).eq("product_id", productId).eq("status", "paid").limit(1).maybeSingle();
  if (owned) return owned.id as string;
  const row = { user_id: userId, product_id: productId, amount: 0, status: "paid" };
  let { data, error } = await db.from("purchases").insert({ ...row, paid_at: new Date().toISOString() }).select("id").single();
  // paid_at only exists after supabase/payments.sql — still unlock without it
  if (error && /paid_at/.test(error.message)) ({ data, error } = await db.from("purchases").insert(row).select("id").single());
  if (error) {
    console.warn("[free] unlock failed:", error.message);
    return null;
  }
  return data!.id as string;
}

/** Where the paid version of each kind of item is sold */
export const CATEGORY_PAGE: Record<ProductCategory, string> = {
  crash_course: "/courses",
  study_material: "/study-material",
  previous_paper: "/previous-year-papers",
  mock_test: "/mock-tests",
};

export type Suggestion = { title: string; price: number; href: string; kind: "product" | "counselling" };

/**
 * After a free download: one related PAID item to suggest.
 * Papers / tests → a paid test pack or crash course; material → crash course.
 * Nothing suitable → counselling booking.
 */
export function suggestFor(category: ProductCategory, paid: Pick<Product, "title" | "price" | "slug" | "category">[]): Suggestion {
  const order: Record<ProductCategory, ProductCategory[]> = {
    previous_paper: ["mock_test", "crash_course", "study_material"],
    mock_test: ["mock_test", "crash_course", "study_material"],
    study_material: ["study_material", "crash_course", "mock_test"],
    crash_course: ["crash_course", "mock_test", "study_material"],
  };
  for (const cat of order[category]) {
    const p = paid.filter((x) => x.category === cat && x.price > 0).sort((a, b) => a.price - b.price)[0];
    if (p) return { title: p.title, price: p.price, href: cat === "crash_course" ? `/courses/${p.slug}` : CATEGORY_PAGE[cat], kind: "product" };
  }
  return { title: "One-to-one VITEEE counselling", price: 0, href: "/book-a-slot", kind: "counselling" };
}
