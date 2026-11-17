import type { Metadata } from "next";
import { formatPhoneIN } from "@/lib/format";
import { Suspense } from "react";
import ReadingLog, { type ReadingRow } from "@/components/admin/ReadingLog";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";
import { profilesById } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Reading log" };

// Admin → Products → Reading log: who read which file, how much, on how many
// devices — with unusual activity flagged (supabase/secure-reader.sql).
// ✏️ When is activity "unusual"? Change these numbers if needed.
const LIMITS = {
  devicesSameFile: 3, // the same file opened on 3+ different devices in 7 days
  devicesAccount: 3, // reading on 3+ different devices in 7 days (account sharing?)
  pagesPerHour: 250, // 250+ page views in one hour (copying page by page?)
};

export default function ReadingPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

/** ISO time n days ago (outside the component: reading the clock is not allowed while rendering) */
function daysAgoISO(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

type Raw = { user_id: string | null; file_id: string | null; page: number; device: string | null; created_at: string; product_files: { display_name: string } | null; products: { title: string } | null };

async function Content() {
  const s = await requireAdmin("/admin/products/reading");
  const since = daysAgoISO(30);
  const { data, error } = await s.supabase
    .from("file_views")
    .select("user_id,file_id,page,device,created_at,product_files(display_name),products(title)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20000);
  const raw = (data ?? []) as unknown as Raw[];
  const people = await profilesById(s, raw.map((r) => r.user_id).filter(Boolean) as string[]);

  const week = Date.parse(daysAgoISO(7));
  type Group = { user: string; file: string; product: string; pages: Set<number>; views: number; devices: Set<string>; devicesWeek: Set<string>; first: string; last: string; hours: Map<string, number> };
  const groups = new Map<string, Group>();
  const accountDevices = new Map<string, Set<string>>();
  for (const r of raw) {
    const user = r.user_id ?? "?";
    const k = `${user}|${r.file_id}`;
    const g: Group = groups.get(k) ?? { user, file: r.product_files?.display_name ?? "(removed file)", product: r.products?.title ?? "—", pages: new Set(), views: 0, devices: new Set(), devicesWeek: new Set(), first: r.created_at, last: r.created_at, hours: new Map() };
    g.pages.add(r.page);
    g.views++;
    if (r.device) {
      g.devices.add(r.device);
      if (Date.parse(r.created_at) > week) {
        g.devicesWeek.add(r.device);
        const set = accountDevices.get(user) ?? new Set<string>();
        set.add(r.device);
        accountDevices.set(user, set);
      }
    }
    if (r.created_at < g.first) g.first = r.created_at;
    if (r.created_at > g.last) g.last = r.created_at;
    const hour = r.created_at.slice(0, 13);
    g.hours.set(hour, (g.hours.get(hour) ?? 0) + 1);
    groups.set(k, g);
  }

  const rows: ReadingRow[] = [...groups.values()].map((g) => {
    const p = people.get(g.user);
    const busiestHour = Math.max(0, ...g.hours.values());
    const acct = accountDevices.get(g.user)?.size ?? 0;
    const flags = [
      g.devicesWeek.size >= LIMITS.devicesSameFile && `this file on ${g.devicesWeek.size} devices in 7 days`,
      acct >= LIMITS.devicesAccount && `account used on ${acct} devices in 7 days`,
      busiestHour >= LIMITS.pagesPerHour && `${busiestHour} page views in one hour`,
    ].filter(Boolean) as string[];
    return {
      key: `${g.user}|${g.file}`,
      student: p?.full_name || "Student",
      email: p?.email || "",
      phone: p?.phone ? formatPhoneIN(p.phone) : "",
      file: g.file,
      product: g.product,
      pagesRead: g.pages.size,
      views: g.views,
      devices: g.devices.size,
      first: g.first,
      last: g.last,
      flags,
    };
  });
  rows.sort((a, b) => b.flags.length - a.flags.length || b.last.localeCompare(a.last));
  return <ReadingLog rows={rows} total={raw.length} setupMissing={!!error} />;
}
