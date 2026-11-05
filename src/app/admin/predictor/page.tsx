import type { Metadata } from "next";
import { Suspense } from "react";
import PredictorAdmin, { type AdminBand, type AdminCutoff, type AdminPrediction } from "@/components/admin/PredictorAdmin";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";
import { profilesById } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Predictor" };

export default function AdminPredictorPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/predictor");
  const [settings, bands, cutoffs, predictions] = await Promise.all([
    s.supabase.from("predictor_settings").select("active_year,disclaimer_text").eq("id", 1).maybeSingle(),
    s.supabase.from("rank_data").select("id,year,min_marks,max_marks,min_rank,max_rank,is_sample").order("year", { ascending: false }).order("min_marks", { ascending: false }),
    s.supabase.from("college_cutoffs").select("id,year,campus,branch,fee_category,counselling_phase,closing_rank,is_sample").order("year", { ascending: false }).order("closing_rank").limit(10000),
    s.supabase.from("predictions").select("id,user_id,marks,entered_rank,predicted_min_rank,predicted_max_rank,preferred_campus,preferred_branch,created_at").order("created_at", { ascending: false }).limit(3000),
  ]);

  const err = settings.error ?? bands.error ?? cutoffs.error ?? predictions.error;
  if (err) {
    const missing = err.message.includes("schema cache") || err.message.includes("does not exist");
    return (
      <div className="card p-6">
        <p className="font-bold text-red-600">{missing ? "The predictor tables don't exist yet." : `Could not load predictor data: ${err.message}`}</p>
        {missing && <p className="mt-2 text-slate-600">Run <strong>supabase/predictor.sql</strong> in Supabase → SQL Editor, then refresh this page.</p>}
      </div>
    );
  }

  const rows = (predictions.data ?? []) as Omit<AdminPrediction, "name" | "email" | "phone">[];
  const people = await profilesById(s, rows.map((r) => r.user_id));
  const leads: AdminPrediction[] = rows.map((r) => {
    const p = people.get(r.user_id);
    return { ...r, name: p?.full_name ?? "", email: p?.email ?? "", phone: p?.phone ?? "" };
  });

  return (
    <PredictorAdmin
      settings={settings.data ?? { active_year: (bands.data ?? [])[0]?.year ?? 2026, disclaimer_text: "" }}
      bands={(bands.data ?? []) as AdminBand[]}
      cutoffs={(cutoffs.data ?? []) as AdminCutoff[]}
      predictions={leads}
    />
  );
}
