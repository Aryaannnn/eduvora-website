// GET /api/cron/reminders — sends the 24-hour and 1-hour session reminder emails.
// Runs automatically:
//   • Vercel Cron: once a day (see vercel.json — the free plan's limit)
//   • cron-job.org: every 15 minutes (free) — needed for the 1-hour reminder.
//     See README "Automatic jobs".
// Each reminder is sent only once, so running it often is safe.
// After each session it also marks the booking 'completed' and, 1 hour after
// the session ends, emails the student the feedback form (once).
// Abandoned checkouts: one friendly email 2 hours and one 24 hours after an
// unfinished payment (only if switched on in Admin → Settings, never if they paid).
// It first retries Google Meet links for upcoming bookings that still have
// none (Google was not connected or failed) — so reminders include the link.
// Protected by CRON_SECRET (src/lib/cron-auth.ts). Without it: 401.
import { NextResponse, type NextRequest } from "next/server";
import { cronHeaders, cronUnauthorised, isCronAuthorised } from "@/lib/cron-auth";
import { completePastBookings, notifyMeetLinkReady, sendCheckoutReminders, sendDueFeedbackRequests, sendDueReminders } from "@/lib/email/notify";
import { retryMissingMeetLinks } from "@/lib/google-calendar";
import { getAdminSupabase } from "@/lib/supabase/admin";

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
  // After the session: mark finished sessions 'completed', then feedback emails (1 hour after the end)
  const completed = await completePastBookings();
  const feedbackEmails = await sendDueFeedbackRequests();
  // "You left something behind" (only when switched on in Admin → Settings)
  const checkout = await sendCheckoutReminders().catch(() => ({ r2h: 0, r24h: 0 }));
  // CRM: collect new leads (signups, enquiries, predictor…) and mark payers as Paid
  const leadRes = await getAdminSupabase()?.rpc("sync_leads").then((r) => r, () => null);
  return NextResponse.json({ ok: true, reminders24h: sent.r24, reminders1h: sent.r1, meetLinksCreated: meetLinks, completed, feedbackEmails, checkoutReminders2h: checkout.r2h, checkoutReminders24h: checkout.r24h, leadsSynced: leadRes && !leadRes.error ? leadRes.data : 0 }, { headers: cronHeaders });
}
