// GET /api/cron/payments — marks payment attempts left "pending" for over
// 30 minutes as paid / failed / abandoned (asks Razorpay first).
// Runs automatically:
//   • Vercel Cron: once a day (see vercel.json — the free plan's limit)
//   • cron-job.org: every 15 minutes (free) — see README "Automatic jobs"
// Protected by CRON_SECRET (src/lib/cron-auth.ts). Without it: 401.
import { NextResponse, type NextRequest } from "next/server";
import { cronHeaders, cronUnauthorised, isCronAuthorised } from "@/lib/cron-auth";
import { sweepStalePayments } from "@/lib/payments-server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { cleanupWatermarked } from "@/lib/watermark";

export async function GET(request: NextRequest) {
  if (!isCronAuthorised(request)) return cronUnauthorised();
  const db = getAdminSupabase();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503, headers: cronHeaders });
  const summary = await sweepStalePayments(db, { limit: 50 });
  const watermarkedCopiesRemoved = await cleanupWatermarked(db).catch(() => 0); // temporary watermarked PDFs
  return NextResponse.json({ ok: true, ...summary, watermarkedCopiesRemoved }, { headers: cronHeaders });
}
