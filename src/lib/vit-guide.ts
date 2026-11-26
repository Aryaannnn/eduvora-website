// The VIT Counselling Guide text (Admin → Settings → VIT Counselling Guide). Cached; an admin save
// refreshes it at once. Until supabase/vit-guide.sql is run, the starting text is shown.
import { cacheLife, cacheTag } from "next/cache";
import { getPublicSupabase } from "./supabase/public";
import { cleanGuide, DEFAULT_GUIDE, type VitGuide } from "./vit-guide-shared";

export async function getVitGuide(): Promise<VitGuide> {
  "use cache";
  cacheTag("settings", "vit-guide");
  cacheLife("minutes");
  const db = getPublicSupabase();
  if (!db) return DEFAULT_GUIDE;
  const { data, error } = await db.from("vit_guide_settings").select("content").eq("id", 1).maybeSingle();
  if (error || !data?.content) return DEFAULT_GUIDE;
  const clean = cleanGuide(data.content);
  return clean.ok ? clean.guide : DEFAULT_GUIDE;
}
