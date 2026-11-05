// GET /api/cron/reminders — sends the 24-hour and 1-hour session reminders.
// Call it every 15 minutes once the website is online, with the header:
//   Authorization: Bearer <CRON_SECRET from .env.local>
// (Vercel Cron sends this header automatically when CRON_SECRET is set.)
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendDueReminders } from "@/lib/email/notify";

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return secret.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const sent = await sendDueReminders();
  return NextResponse.json({ ok: true, reminders24h: sent.r24, reminders1h: sent.r1 }, { headers: { "Cache-Control": "no-store" } });
}
