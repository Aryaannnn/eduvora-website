import type { Metadata } from "next";
import { Suspense } from "react";
import FeesManager from "@/components/admin/FeesManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";
import type { Campus, CampusFee } from "@/lib/fees-shared";

export const metadata: Metadata = { title: "Fees & Campuses" };

export default function FeesSettingsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/settings/fees");
  const [c, f] = await Promise.all([
    s.supabase.from("campuses").select("id,name,location,branches,hostel_fee_min,hostel_fee_max,notes,website,sort_order,is_sample").order("sort_order").order("name"),
    s.supabase.from("campus_fees").select("id,year,campus,fee_category,rank_from,rank_to,tuition_per_year,notes,is_sample").order("year", { ascending: false }).order("campus").order("fee_category"),
  ]);
  const err = c.error ?? f.error;
  if (err) {
    const missing = err.code === "42P01" || err.code === "PGRST205";
    return <p className="card p-6 text-red-600">{missing ? "Run supabase/fees-campuses.sql in Supabase → SQL Editor to turn on the Fee Calculator." : `Could not load fees: ${err.message}`}</p>;
  }
  return <FeesManager campuses={(c.data ?? []) as Campus[]} fees={(f.data ?? []) as CampusFee[]} />;
}
