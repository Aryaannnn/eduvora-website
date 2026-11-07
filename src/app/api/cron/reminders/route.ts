// GET /api/cron/reminders — sends the 24-hour and 1-hour session reminder emails.
// Runs automatically:
//   • Vercel Cron: once a day (see vercel.json — the free plan's limit)
//   • cron-job.org: every 15 minutes (free) — needed for the 1-hour reminder.
//     See README "Automatic jobs".
// Each reminder is sent only once, so running it often is safe.
// It first retries Google Meet links for upcoming bookings that still have
// none (Google was not connected or failed) — so reminders include the link.
// Protected by CRON_SECRET (src/lib/cron-auth.ts). Without it: 401.
import { NextResponse, type NextRequest } from "next/server";
import { cronHeaders, cronUnauthorised, isCronAuthorised } from "@/lib/cron-auth";
import { notifyMeetLinkReady, sendDueReminders } from "@/lib/email/notify";
import { retryMissingMeetLinks } from "@/lib/google-calendar";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronAuthorised(request)) return cronUnauthorised();
  let meetLinks = 0;
  try {
    const got = await retryMissingMeetLinks(10);
    meetLinks = got.length;
    for (const id of got) notifyMeetLinkReady(id);
  } catch (e) {
    console.warn("[cron] Meet link retry failed:", (e as Error).message);
  }
  const sent = await sendDueReminders();
  return NextResponse.json({ ok: true, reminders24h: sent.r24, reminders1h: sent.r1, meetLinksCreated: meetLinks }, { headers: cronHeaders });
}
