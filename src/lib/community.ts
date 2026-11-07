// =====================================================================
//  WHATSAPP COMMUNITY LINK (Admin → Settings)
//  Empty = every "Join our WhatsApp community" banner is hidden.
//  Buttons go to /go/community?from=…, which counts the click and then
//  opens the real link (supabase/whatsapp-community.sql).
// =====================================================================
import { cacheLife, cacheTag } from "next/cache";
import { getPublicSupabase } from "./supabase/public";

export const COMMUNITY_SOURCES = ["home", "dates", "dashboard", "signup", "email", "other"] as const;
export type CommunitySource = (typeof COMMUNITY_SOURCES)[number];

/** The community link, or null when it isn't set (cached; refreshed instantly when the admin saves). */
export async function getCommunityLink(): Promise<string | null> {
  "use cache";
  cacheTag("community");
  const supabase = getPublicSupabase();
  if (!supabase) return (cacheLife("minutes"), null);
  const { data, error } = await supabase.from("community_settings").select("whatsapp_link").eq("id", 1).maybeSingle();
  if (error) {
    cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
    return null;
  }
  cacheLife("hours");
  return (data?.whatsapp_link as string | null) || null;
}

export const communityHref = (from: CommunitySource) => `/go/community?from=${from}`;
