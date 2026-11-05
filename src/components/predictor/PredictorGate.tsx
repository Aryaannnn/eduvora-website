// =====================================================================
//  PREDICTOR GATE (server)
//  Decides on the SERVER: locked screen, or the real predictor.
//  Students without access never receive the tool or any data.
// =====================================================================
import { Suspense } from "react";
import { getSession } from "@/lib/dashboard";
import { getPredictorAccess, getPredictorDataForAllowedUser, optionsFrom } from "@/lib/predictor-server";
import PredictorLocked from "./PredictorLocked";
import PredictorTool, { type PastPrediction } from "./PredictorTool";

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
  if (!access.allowed) return <PredictorLocked loggedIn={access.loggedIn} returnTo={returnTo} />;

  const options = optionsFrom(await getPredictorDataForAllowedUser());
  if (mode === "public") return <PredictorTool options={options} mode="public" />;

  const s = (await getSession())!;
  const { data: history } = await s.supabase
    .from("predictions")
    .select("id,marks,entered_rank,predicted_min_rank,predicted_max_rank,preferred_campus,preferred_branch,created_at")
    .eq("user_id", s.user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const name = s.profile?.full_name || s.user.email?.split("@")[0] || "Student";
  return <PredictorTool options={options} mode="dashboard" userName={name} initialHistory={(history ?? []) as PastPrediction[]} />;
}
