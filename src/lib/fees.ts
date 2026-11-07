// Fees & campuses for the public Fee Calculator (cached; refreshed when the
// admin saves — updateTag("fees")). Tables: supabase/fees-campuses.sql.
import { cacheLife, cacheTag } from "next/cache";
import type { Campus, CampusFee } from "./fees-shared";
import { getPublicSupabase } from "./supabase/public";

export async function getFeeData(): Promise<{ campuses: Campus[]; fees: CampusFee[]; ready: boolean }> {
  "use cache";
  cacheTag("fees");
  const supabase = getPublicSupabase();
  if (!supabase) return (cacheLife("minutes"), { campuses: [], fees: [], ready: false });
  const [c, f] = await Promise.all([
    supabase.from("campuses").select("id,name,location,branches,hostel_fee_min,hostel_fee_max,notes,website,sort_order,is_sample").order("sort_order").order("name"),
    supabase.from("campus_fees").select("id,year,campus,fee_category,rank_from,rank_to,tuition_per_year,notes,is_sample").order("year", { ascending: false }).order("campus").order("fee_category"),
  ]);
  if (c.error || f.error) {
    console.warn("Supabase fees:", (c.error ?? f.error)?.message, "(run supabase/fees-campuses.sql?)");
    cacheLife({ stale: 60, revalidate: 60, expire: 600 });
    return { campuses: [], fees: [], ready: false };
  }
  cacheLife("hours");
  return { campuses: (c.data ?? []) as Campus[], fees: (f.data ?? []) as CampusFee[], ready: true };
}
