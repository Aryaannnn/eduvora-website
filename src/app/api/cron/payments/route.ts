// GET /api/cron/payments — runs the "pending > 30 min" cleanup.
// Call it every 15 minutes from a scheduler (Vercel Cron, cron-job.org, …)
// with the header:   Authorization: Bearer <CRON_SECRET from .env.local>
// (Vercel Cron sends this header automatically when CRON_SECRET is set.)
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sweepStalePayments } from "@/lib/payments-server";
import { getAdminSupabase } from "@/lib/supabase/admin";

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return secret.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const db = getAdminSupabase();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const summary = await sweepStalePayments(db, { limit: 50 });
  return NextResponse.json({ ok: true, ...summary }, { headers: { "Cache-Control": "no-store" } });
}
