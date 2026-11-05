import type { Metadata } from "next";
import { Suspense } from "react";
import SlotsManager, { type AdminSlot } from "@/components/admin/SlotsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";
import { todayInIndia } from "@/lib/format";

export const metadata: Metadata = { title: "Slots" };

export default function SlotsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/slots");
  const { data, error } = await s.supabase
    .from("slots")
    .select("id,date,start_time,end_time,price,is_available,bookings(id,name,status)")
    .gte("date", todayInIndia())
    .order("date")
    .order("start_time")
    .limit(1000);
  if (error) return <p className="card p-6 text-red-600">Could not load slots: {error.message}</p>;
  return <SlotsManager slots={(data ?? []) as AdminSlot[]} today={todayInIndia()} />;
}
