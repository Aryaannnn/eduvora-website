import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DashSkeleton } from "@/components/dashboard/ui";
import AttemptReport, { type Report } from "@/components/tests/AttemptReport";
import { requireUser } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Test Result & Review", robots: { index: false } };

// /dashboard/tests/review?attempt=<id> — the full report of a past attempt.
// attempt_report() only returns it to the student who took the test (or an admin).
export default function ReviewPage({ searchParams }: PageProps<"/dashboard/tests/review">) {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/dashboard/tests/review">["searchParams"] }) {
  const sp = await searchParams;
  const id = typeof sp.attempt === "string" && /^[0-9a-f-]{36}$/i.test(sp.attempt) ? sp.attempt : "";
  const s = await requireUser(`/dashboard/tests/review?attempt=${id}`);
  const { data, error } = id ? await s.supabase.rpc("attempt_report", { p_attempt: id }) : { data: null, error: { message: "not found" } };
  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="font-bold text-slate-900">{error && /function/i.test(error.message) ? "Detailed results are being set up — please check back soon." : "This test attempt was not found."}</p>
        <Link href="/dashboard/tests" className="btn-primary mt-5">My Tests</Link>
      </div>
    );
  }
  return <AttemptReport r={data as Report} openReview />;
}
