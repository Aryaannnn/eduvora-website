// Admin → Settings switch: show or hide the crossed-out "original price" and the
// "% off" badges everywhere. When it is OFF the server simply leaves out
// original_price before any page gets the product, so every card, course page
// and package hides both labels automatically.
// (Table: supabase/price-labels.sql. Until it's run, the labels show — as before.)
import { cacheLife, cacheTag } from "next/cache";
import { getPublicSupabase } from "./supabase/public";

export async function showOriginalPrices(): Promise<boolean> {
  "use cache";
  cacheTag("settings");
  const supabase = getPublicSupabase();
  if (!supabase) return (cacheLife("minutes"), true);
  const { data, error } = await supabase.from("display_settings").select("show_original_price").eq("id", 1).maybeSingle();
  if (error || !data) {
    cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
    return true;
  }
  cacheLife("minutes");
  return data.show_original_price !== false;
}

/** Removes original_price from products when the switch is OFF. */
export async function applyPriceLabels<T extends { original_price?: number | null }>(items: T[]): Promise<T[]> {
  if (await showOriginalPrices()) return items;
  return items.map((p) => ({ ...p, original_price: null }));
}
