import type { Metadata } from "next";
import { Suspense } from "react";
import FeedbackManager, { type AdminFeedback } from "@/components/admin/FeedbackManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Feedback" };

export default function FeedbackPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/feedback");
  const { data, error } = await s.supabase
    .from("session_feedback")
    .select("id,rating,helped_most,improve,allow_public,consent_at,review_id,created_at,bookings(name,email,phone,slots(date,start_time))")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    const missing = error.code === "42P01" || error.code === "PGRST205" || /session_feedback/.test(error.message);
    return <p className="card p-6 text-red-600">{missing ? "Run supabase/feedback.sql in Supabase → SQL Editor to turn on session feedback." : `Could not load feedback: ${error.message}`}</p>;
  }
  // Was the published review deleted since? Then it can be published again.
  const reviewIds = (data ?? []).map((f) => f.review_id).filter(Boolean) as string[];
  const { data: live } = reviewIds.length ? await s.supabase.from("reviews").select("id").in("id", reviewIds) : { data: [] };
  const liveIds = new Set((live ?? []).map((r) => r.id as string));
  const rows = ((data ?? []) as unknown as AdminFeedback[]).map((f) => ({ ...f, review_id: f.review_id && liveIds.has(f.review_id) ? f.review_id : null }));
  return <FeedbackManager feedback={rows} />;
}
