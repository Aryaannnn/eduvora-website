// =====================================================================
//  PREDICTOR GATE (server)
//  Decides on the SERVER which version of the predictor a visitor gets:
//    • not logged in → marks input + "log in / sign up to see your rank"
//    • logged in     → FREE: rank range only (+ blurred SAMPLE college list)
//    • paid / admin  → FULL: colleges, chances, fee categories, filters, PDF
//  Real cutoff data is never sent to the browser. Users without full
//  access don't even get the campus / branch lists.
// =====================================================================
import { Suspense } from "react";
import { getSession } from "@/lib/dashboard";
import { basicOptionsFrom, getPredictorAccess, loadPredictorDataOnServer, optionsFrom } from "@/lib/predictor-server";
import PredictorTool, { type PastPrediction, type PredictorAccessLevel } from "./PredictorTool";

type Props = { mode: "public" | "dashboard"; returnTo?: string };

export default function PredictorGate(props: Props) {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-slate-100" aria-busy="true" />}>
      <Gate {...props} />
    </Suspense>
  );
}

async function Gate({ mode, returnTo = "/predictor" }: Props) {
  const access = await getPredictorAccess();
  const level: PredictorAccessLevel = access.allowed ? "full" : access.loggedIn ? "free" : "guest";

  const data = await loadPredictorDataOnServer();
  const options = level === "full" ? optionsFrom(data) : basicOptionsFrom(data);

  if (mode === "public" || level === "guest") {
    return <PredictorTool options={options} mode="public" access={level} returnTo={returnTo} />;
  }

  const s = (await getSession())!;
  const { data: history } = await s.supabase
    .from("predictions")
    .select("id,marks,entered_rank,predicted_min_rank,predicted_max_rank,preferred_campus,preferred_branch,created_at")
    .eq("user_id", s.user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const name = s.profile?.full_name || s.user.email?.split("@")[0] || "Student";
  return (
    <PredictorTool options={options} mode="dashboard" access={level} returnTo={returnTo} userName={name} initialHistory={(history ?? []) as PastPrediction[]} />
  );
}
