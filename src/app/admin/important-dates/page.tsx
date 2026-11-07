import type { Metadata } from "next";
import { Suspense } from "react";
import DatesManager, { type AdminDate, type AdminUpdate } from "@/components/admin/DatesManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";
import { todayInIndia } from "@/lib/format";
import { statusFor } from "@/lib/important-dates-shared";

export const metadata: Metadata = { title: "Important Dates" };

export default function AdminDatesPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/important-dates");
  const [dates, updates] = await Promise.all([
    s.supabase.from("important_dates").select("id,title,category,start_date,end_date,description,official_link,sort_order,is_published,is_sample").order("sort_order").order("start_date"),
    s.supabase.from("site_updates").select("id,title,body,link,is_pinned,is_published,published_at").order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).limit(200),
  ]);
  const today = todayInIndia();
  return (
    <DatesManager
      setupMissing={!!dates.error}
      dates={((dates.data ?? []) as Omit<AdminDate, "status">[]).map((d) => ({ ...d, status: statusFor(d.start_date, d.end_date, today) }))}
      updates={(updates.data ?? []) as AdminUpdate[]}
    />
  );
}
