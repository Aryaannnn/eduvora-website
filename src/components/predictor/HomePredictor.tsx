// The Rank Predictor on the HOME page. Same as <PredictorGate mode="public" />,
// but it never imports the predictor code itself: <LazyPredictorTool> downloads
// it only when the visitor scrolls near it (faster home page on slow phones).
import { Suspense } from "react";
import { basicOptionsFrom, getPredictorAccess, loadPredictorDataOnServer, optionsFrom } from "@/lib/predictor-server";
import LazyPredictorTool from "./LazyPredictorTool";
import type { PredictorAccessLevel } from "./PredictorTool";

export default function HomePredictor({ returnTo }: { returnTo: string }) {
  return (
    <Suspense fallback={<div className="card min-h-[24rem] animate-pulse bg-slate-100" aria-busy="true" />}>
      <Tool returnTo={returnTo} />
    </Suspense>
  );
}

async function Tool({ returnTo }: { returnTo: string }) {
  const access = await getPredictorAccess();
  const level: PredictorAccessLevel = access.allowed ? "full" : access.loggedIn ? "free" : "guest";
  const data = await loadPredictorDataOnServer();
  const options = level === "full" ? optionsFrom(data) : basicOptionsFrom(data);
  return <LazyPredictorTool options={options} mode="public" access={level} returnTo={returnTo} />;
}
