// POST /api/predictor — runs the rank & college calculation ON THE SERVER.
// body: { inputType: "marks"|"rank", marks?, rank?, campus?, branch?, feeCategory?, full?, save? }
// Students without predictor access get 403 and NO data at all.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { getPredictorAccess, getPredictorDataForAllowedUser, parsePredictInput, runPrediction } from "@/lib/predictor-server";
import { getAdminSupabase } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  const access = await getPredictorAccess();
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.loggedIn ? "Book a counselling session to unlock the predictor." : "Please log in.", locked: true },
      { status: access.loggedIn ? 403 : 401, headers },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parsePredictInput(body);
  if (!input) return NextResponse.json({ error: "Please enter valid marks or rank." }, { status: 400, headers });

  const data = await getPredictorDataForAllowedUser();
  const result = runPrediction(input, data);

  // Dashboard: save this prediction to "My Past Predictions" (server-side, so it can't be faked)
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
        .select("id,marks,entered_rank,predicted_min_rank,predicted_max_rank,preferred_campus,preferred_branch,created_at")
        .single();
      saved = row;
    }
  }

  return NextResponse.json({ ...result, saved }, { headers });
}
