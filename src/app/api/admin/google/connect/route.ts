// GET /api/admin/google/connect → Google's "Allow access to your calendar" page.
// ADMINS ONLY (with 2-step login). Started by Admin → Settings → "Connect Google Calendar".
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdmin2fa } from "@/lib/admin";
import { getSession } from "@/lib/dashboard";
import { googleAuthUrl, isCalendarConfigured } from "@/lib/google-calendar";

const STATE_COOKIE = "eduvora_gcal_state";

export async function GET(request: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/settings?google=${q}#google-calendar`, request.url));
  const s = await getSession();
  if (!s || s.profile?.role !== "admin" || !(await hasAdmin2fa(s))) return NextResponse.redirect(new URL("/login?next=/admin/settings", request.url));
  if (!isCalendarConfigured()) return back("keys-missing");

  // Random "state" stops anyone else from finishing this connection for us
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(googleAuthUrl(state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/admin/google", maxAge: 600 });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
