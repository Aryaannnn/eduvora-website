// Lead capture settings (Admin → Settings → "Lead capture"; table growth_settings,
// supabase/lead-capture.sql): the free guide popup and abandoned-checkout reminders.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getAdminSupabase } from "./supabase/admin";
import { getPublicSupabase } from "./supabase/public";

export type GuideOffer = { productId: string; title: string };

/**
 * The free guide offered in the popup, or null (popup off / no guide chosen /
 * the guide has no file yet / setup not run). Cached; Settings refreshes it.
 */
export async function getGuideOffer(): Promise<GuideOffer | null> {
  "use cache";
  cacheTag("settings", "products"); // Settings / product saves refresh it at once
  cacheLife("hours"); // (so pages keep their normal, longer cache time)
  const pub = getPublicSupabase();
  if (!pub) return null;
  const { data: g, error } = await pub.from("growth_settings").select("guide_enabled,guide_product_id").eq("id", 1).maybeSingle();
  if (error || !g?.guide_enabled || !g.guide_product_id) return null;
  const { data: p } = await pub.from("products").select("id,title,is_active").eq("id", g.guide_product_id).maybeSingle();
  if (!p?.is_active) return null;
  const file = await guideFile(p.id as string);
  return file ? { productId: p.id as string, title: p.title as string } : null;
}

/** The guide's PDF (first file of the product), read with the server key. */
export async function guideFile(productId: string): Promise<{ path: string; name: string } | null> {
  const db = getAdminSupabase();
  if (!db) return null;
  const { data } = await db.from("product_files").select("file_path,display_name,file_type").eq("product_id", productId).order("sort_order").order("created_at").limit(1).maybeSingle();
  if (data?.file_path) return { path: data.file_path as string, name: `${String(data.display_name).replace(/[^\w .-]+/g, "").trim() || "guide"}.${data.file_type ?? "pdf"}` };
  // older products: a single file_path on the product
  const { data: p } = await db.from("products").select("file_path,title").eq("id", productId).maybeSingle();
  return p?.file_path ? { path: p.file_path as string, name: `${String(p.title).replace(/[^\w .-]+/g, "").trim() || "guide"}.pdf` } : null;
}

export type GrowthSettings = { guide_enabled: boolean; guide_product_id: string | null; abandoned_reminders: boolean; abandoned_enabled_at: string | null };

/** Fresh settings for the reminder job (not cached). */
export async function readGrowthSettings(): Promise<GrowthSettings | null> {
  const db = getAdminSupabase();
  if (!db) return null;
  const { data, error } = await db.from("growth_settings").select("guide_enabled,guide_product_id,abandoned_reminders,abandoned_enabled_at").eq("id", 1).maybeSingle();
  return error || !data ? null : (data as GrowthSettings);
}
