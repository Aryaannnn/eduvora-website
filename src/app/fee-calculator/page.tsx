import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMeta, breadcrumbLd } from "@/lib/seo";
import Link from "next/link";
import { Suspense } from "react";
import CampusCompare from "@/components/fees/CampusCompare";
import FeeCalculator from "@/components/fees/FeeCalculator";
import { CalendarIcon, ExternalIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import { siteConfig } from "@/config/site";
import { getSession } from "@/lib/dashboard";
import { getFeeData } from "@/lib/fees";
import { FEE_NOTE } from "@/lib/fees-shared";

export const metadata: Metadata = pageMeta({ title: "VIT Fee Calculator & Campus Comparison", description: "Estimate your VIT fee category and 4-year tuition from your VITEEE rank, and compare VIT campuses side by side. Estimates — confirm on vit.ac.in.", path: "/fee-calculator" });

// ✏️ Fee data and campus details: Admin → Settings → Fees & Campuses.
export default async function FeeCalculatorPage({ searchParams }: PageProps<"/fee-calculator">) {
  const { campuses, fees } = await getFeeData();
  const sample = campuses.some((c) => c.is_sample) || fees.some((f) => f.is_sample);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Fee Calculator", path: "/fee-calculator" }])} />
      <PageHero eyebrow="Plan your budget" title="Fee Calculator & Campus Comparison" subtitle="Enter your VITEEE rank to see your likely fee category and tuition, then compare campuses side by side." />

      <div className="container-page space-y-12 py-10 sm:py-14">
        {sample && (
          <p className="rounded-2xl bg-red-50 p-4 text-center text-sm font-bold text-red-800 ring-2 ring-red-300">
            ⚠️ SAMPLE DATA — the fees and campus details below are placeholders, not real VIT figures.
          </p>
        )}

        <section aria-labelledby="calc-h">
          <h2 id="calc-h" className="mb-4 text-2xl font-extrabold text-slate-900">Fee calculator</h2>
          <Suspense fallback={<div className="card h-80 animate-pulse" />}>
            <Calculator searchParams={searchParams} />
          </Suspense>
        </section>

        <section aria-labelledby="cmp-h" id="compare" className="scroll-mt-24">
          <h2 id="cmp-h" className="mb-4 text-2xl font-extrabold text-slate-900">Compare campuses</h2>
          <CampusCompare campuses={campuses} fees={fees} />
        </section>

        <section className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-extrabold text-slate-900">Not sure which campus and category is right for you?</p>
            <p className="text-sm text-slate-600">Talk to {siteConfig.founder.name} — get a campus, branch and fee plan for your rank.</p>
          </div>
          <Link href="/book-a-slot" className="btn-primary"><CalendarIcon className="h-4 w-4" /> Book counselling</Link>
        </section>

        <p className="text-center text-xs text-slate-500">
          {FEE_NOTE} <a href="https://vit.ac.in" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">vit.ac.in <ExternalIcon className="h-3 w-3" /></a>
          {" "}Hostel, mess and other charges are separate from tuition.
        </p>
      </div>
    </>
  );
}

/** Rank from the link (?rank=) or the student's last prediction. */
async function Calculator({ searchParams }: { searchParams: PageProps<"/fee-calculator">["searchParams"] }) {
  const [sp, { campuses, fees }, s] = await Promise.all([searchParams, getFeeData(), getSession()]);
  const fromLink = Number(typeof sp.rank === "string" ? sp.rank : NaN);
  let predicted: { rank: number; min: number; max: number } | null = null;
  if (s) {
    // RLS: a student reads only their own predictions
    const { data } = await s.supabase
      .from("predictions")
      .select("entered_rank,predicted_min_rank,predicted_max_rank")
      .eq("user_id", s.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const min = Number(data.predicted_min_rank), max = Number(data.predicted_max_rank);
      predicted = { rank: data.entered_rank ? Number(data.entered_rank) : Math.round((min + max) / 2), min, max };
    }
  }
  const startRank = Number.isInteger(fromLink) && fromLink >= 1 ? fromLink : predicted?.rank ?? null;
  return <FeeCalculator campuses={campuses} fees={fees} startRank={startRank} predicted={predicted} />;
}
