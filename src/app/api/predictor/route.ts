// POST /api/predictor — runs the rank & college calculation ON THE SERVER.
// body: { inputType: "marks"|"rank", marks?, rank?, campus?, branch?, feeCategory?, full?, save? }
//
// Who gets what (decided here, on the server):
//   • not logged in            → 401, nothing calculated
//   • logged in (free)         → ONLY the predicted rank range + percentile.
//                                No colleges, no counts, no cutoffs.
//   • paid counselling / admin → the full result (colleges, chances, fee categories)
// With save:true the prediction is stored, so the admin sees it as a lead.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { getPredictorAccess, loadPredictorDataOnServer, parsePredictInput, runPrediction } from "@/lib/predictor-server";
import { getAdminSupabase } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
const SAVED_COLS = "id,marks,entered_rank,predicted_min_rank,predicted_max_rank,preferred_campus,preferred_branch,created_at";

export async function POST(request: NextRequest) {
  const access = await getPredictorAccess();
  if (!access.loggedIn) {
    return NextResponse.json({ error: "Please log in or sign up to see your rank.", login: true }, { status: 401, headers });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parsePredictInput(body);
  if (!parsed) return NextResponse.json({ error: "Please enter valid marks or rank." }, { status: 400, headers });

  // Free students can never ask for the full list or use the filters
  const input = access.allowed ? parsed : { ...parsed, full: false, campus: undefined, branch: undefined, feeCategory: undefined };

  const data = await loadPredictorDataOnServer();
  const result = runPrediction(input, data);

  // Save this prediction (server-side, so it can't be faked). Shows in Admin → Predictor as a lead.
  let saved = null;
  if (body.save === true && result.prediction) {
    const session = await getSession();
    const db = getAdminSupabase();
    if (session && db) {
      const p = result.prediction;
      const { data: row } = await db
        .from("predictions")
        .insert({
          user_id: session.user.id,
          marks: p.source === "marks" ? p.marks : null,
          entered_rank: p.source === "rank" ? p.rank : null,
          predicted_min_rank: p.minRank,
          predicted_max_rank: p.maxRank,
          preferred_campus: input.campus ?? null,
          preferred_branch: input.branch ?? null,
          data_year: data.activeYear,
        })
        .select(SAVED_COLS)
        .single();
      saved = row;
    }
  }

  if (!access.allowed) {
    // FREE: rank range only. Nothing that comes from the college cutoff table.
    return NextResponse.json({ prediction: result.prediction, percentile: result.percentile, full: false, saved }, { headers });
  }
  return NextResponse.json({ ...result, full: true, saved }, { headers });
}
