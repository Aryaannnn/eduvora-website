import type { Metadata } from "next";
import { Suspense } from "react";
import ActivityLog, { type ActivityRow } from "@/components/admin/ActivityLog";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Activity Log" };

export default function ActivityPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/activity");
  const { data, error } = await s.supabase
    .from("admin_activity")
    .select("id,admin_name,action,entity,summary,details,created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  return <ActivityLog rows={(data ?? []) as ActivityRow[]} setupMissing={!!error} />;
}
