import type { Metadata } from "next";
import { Suspense } from "react";
import ReviewsManager, { type AdminReview } from "@/components/admin/ReviewsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";
import { profilesById } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/reviews");
  const base = "id,name,type,rating,comment,photo_url,is_approved,created_at";
  const first = await s.supabase.from("reviews").select(`${base},user_id,is_verified,consent_given`).order("created_at", { ascending: false });
  let data = first.data as AdminReview[] | null;
  let error = first.error;
  // before supabase/stats-reviews.sql is run, the new columns don't exist yet
  if (error && /user_id|is_verified|consent_given/.test(error.message)) {
    const again = await s.supabase.from("reviews").select(base).order("created_at", { ascending: false });
    data = again.data as AdminReview[] | null;
    error = again.error;
  }
  if (error) return <p className="card p-6 text-red-600">Could not load reviews: {error.message}</p>;
  const rows = (data ?? []) as AdminReview[];
  const people = await profilesById(s, rows.map((r) => r.user_id).filter(Boolean) as string[]);
  return <ReviewsManager reviews={rows.map((r) => ({ ...r, writer_email: r.user_id ? people.get(r.user_id)?.email ?? "" : undefined }))} />;
}
