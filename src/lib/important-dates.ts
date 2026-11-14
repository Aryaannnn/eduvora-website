// =====================================================================
//  IMPORTANT DATES & LATEST UPDATES (public data, cached)
//  Edit them in Admin → Important Dates (tables from supabase/important-dates.sql).
//  Status is worked out automatically from the dates, in India time:
//    today before the start          → Upcoming
//    today between start and end      → Ongoing
//    today after the end (or the day) → Completed
// =====================================================================
import { withoutSamples } from "./sample";
import { cacheLife, cacheTag } from "next/cache";
import { todayInIndia } from "./format";
import { getPublicSupabase } from "./supabase/public";

import { CATEGORY_LABEL, statusFor, type DateCategory, type DateStatus } from "./important-dates-shared";

export { CATEGORY_LABEL, statusFor, type DateCategory, type DateStatus };

export type ImportantDate = {
  id: string;
  title: string;
  category: DateCategory;
  start_date: string; // "2026-04-20"
  end_date: string | null;
  description: string | null;
  official_link: string | null;
  sort_order: number;
  is_sample: boolean;
  status: DateStatus;
  daysToGo: number; // days until the start (0 = today, negative = started)
};

export type SiteUpdate = { id: string; title: string; body: string | null; link: string | null; is_pinned: boolean; published_at: string };

const dayNumber = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);

/** All published events (in the admin's order) with their status. Refreshed every hour. */
export async function getImportantDates(): Promise<ImportantDate[]> {
  "use cache";
  cacheTag("important-dates");
  const supabase = getPublicSupabase();
  if (!supabase) return (cacheLife("minutes"), []);
  const { data, error } = await supabase
    .from("important_dates")
    .select("id,title,category,start_date,end_date,description,official_link,sort_order,is_sample")
    .order("sort_order")
    .order("start_date");
  if (error) {
    console.warn("Supabase important_dates:", error.message, "(run supabase/important-dates.sql?)");
    cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
    return [];
  }
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 }); // status can change at midnight
  const today = todayInIndia();
  // SAMPLE dates are hidden once the website is Live (src/lib/sample.ts)
  return withoutSamples((data ?? []) as Omit<ImportantDate, "status" | "daysToGo">[]).map((d) => ({
    ...d,
    status: statusFor(d.start_date, d.end_date, today),
    daysToGo: dayNumber(d.start_date) - dayNumber(today),
  }));
}

/** The next few events that haven't finished (ongoing first, then soonest). */
export async function getNextDates(limit = 3): Promise<ImportantDate[]> {
  const all = await getImportantDates();
  return all
    .filter((d) => d.status !== "completed")
    .sort((a, b) => (a.status === b.status ? a.start_date.localeCompare(b.start_date) : a.status === "ongoing" ? -1 : 1))
    .slice(0, limit);
}

/** Latest Updates (pinned first, then newest). */
export async function getSiteUpdates(limit = 20): Promise<SiteUpdate[]> {
  "use cache";
  cacheTag("important-dates");
  const supabase = getPublicSupabase();
  if (!supabase) return (cacheLife("minutes"), []);
  const { data, error } = await supabase
    .from("site_updates")
    .select("id,title,body,link,is_pinned,published_at")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
    return [];
  }
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 }); // scheduled posts appear within ~15 min
  return withoutSamples((data ?? []) as SiteUpdate[]);
}
