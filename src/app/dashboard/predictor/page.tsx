import type { Metadata } from "next";
import { Suspense } from "react";
import { DashSkeleton, PageHeader } from "@/components/dashboard/ui";
import PredictorGate from "@/components/predictor/PredictorGate";
import { requireUser } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Rank & College Predictor" };

// Locked unless the student has PAID for counselling (checked on the server)
export default function DashboardPredictorPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireUser("/dashboard/predictor");
  return (
    <>
      <PageHeader title="Rank & College Predictor" subtitle="Your full result with every campus, branch and fee category. Each prediction is saved automatically." />
      <PredictorGate mode="dashboard" returnTo="/dashboard/predictor" />
    </>
  );
}
