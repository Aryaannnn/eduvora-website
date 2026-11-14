// Loads the "Why EDUVORA?" cards for the home page (cached; Admin → Settings refreshes it instantly).
import { cacheLife, cacheTag } from "next/cache";
import { getPublicSupabase } from "./supabase/public";
import { DEFAULT_WHY, WHY_LIMITS, cleanWhyCards, type WhySettings } from "./why-shared";

export async function getWhySettings(): Promise<WhySettings> {
  "use cache";
  cacheTag("settings");
  const supabase = getPublicSupabase();
  if (!supabase) return (cacheLife("minutes"), DEFAULT_WHY);
  const { data, error } = await supabase.from("why_settings").select("enabled,title,cards").eq("id", 1).maybeSingle();
  if (error || !data) {
    // Not set up yet (supabase/why-eduvora.sql) or a hiccup → the default cards; try again soon
    cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
    return DEFAULT_WHY;
  }
  cacheLife("minutes");
  const cards = cleanWhyCards(data.cards);
  return {
    enabled: data.enabled !== false,
    title: String(data.title || DEFAULT_WHY.title).slice(0, WHY_LIMITS.heading),
    cards: cards.ok ? cards.cards : DEFAULT_WHY.cards,
  };
}
