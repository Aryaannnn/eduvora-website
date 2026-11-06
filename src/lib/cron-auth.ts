// =====================================================================
//  CRON PROTECTION (server only)
//  The automatic jobs (/api/cron/payments and /api/cron/reminders) only run
//  when the request carries the header:
//      Authorization: Bearer <CRON_SECRET>
//  • Vercel Cron adds this header by itself when CRON_SECRET is set in Vercel.
//  • cron-job.org: add the same header under "Advanced → Headers".
//  CRON_SECRET must be at least 16 characters, otherwise every call is refused.
// =====================================================================
import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export function isCronAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const got = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return secret.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export const cronHeaders = { "Cache-Control": "no-store" };

export function cronUnauthorised() {
  return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: cronHeaders });
}
