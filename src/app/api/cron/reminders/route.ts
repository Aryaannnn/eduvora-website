// GET /api/cron/reminders — sends the 24-hour and 1-hour session reminder emails.
// Runs automatically:
//   • Vercel Cron: once a day (see vercel.json — the free plan's limit)
//   • cron-job.org: every 15 minutes (free) — needed for the 1-hour reminder.
//     See README "Automatic jobs".
// Each reminder is sent only once, so running it often is safe.
// Protected by CRON_SECRET (src/lib/cron-auth.ts). Without it: 401.
import { NextResponse, type NextRequest } from "next/server";
import { cronHeaders, cronUnauthorised, isCronAuthorised } from "@/lib/cron-auth";
import { sendDueReminders } from "@/lib/email/notify";

export async function GET(request: NextRequest) {
  if (!isCronAuthorised(request)) return cronUnauthorised();
  const sent = await sendDueReminders();
  return NextResponse.json({ ok: true, reminders24h: sent.r24, reminders1h: sent.r1 }, { headers: cronHeaders });
}
