// =====================================================================
//  REFERRALS — public settings (₹ off for the new student, ₹ reward for
//  the referrer). Edit them in Admin → Settings. Server-side checks live in
//  supabase/coupons-referrals.sql and src/lib/pricing.ts.
// =====================================================================
import { cacheLife, cacheTag } from "next/cache";
import { getPublicSupabase } from "./supabase/public";

export type ReferralSettings = { enabled: boolean; referred_discount: number; referrer_reward: number };
export const DEFAULT_REFERRAL: ReferralSettings = { enabled: true, referred_discount: 100, referrer_reward: 100 };

/** Cached; null when coupons-referrals.sql hasn't been run yet. */
export async function getReferralSettings(): Promise<ReferralSettings | null> {
  "use cache";
  cacheTag("referral-settings");
  const supabase = getPublicSupabase();
  if (!supabase) return (cacheLife("minutes"), null);
  const { data, error } = await supabase.from("referral_settings").select("enabled,referred_discount,referrer_reward").eq("id", 1).maybeSingle();
  if (error || !data) {
    cacheLife({ stale: 300, revalidate: 30, expire: 3600 });
    return null;
  }
  cacheLife("minutes");
  return data as ReferralSettings;
}
