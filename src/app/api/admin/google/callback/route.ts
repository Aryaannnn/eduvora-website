// GET /api/admin/google/callback — Google sends the admin back here after "Allow".
// Checks admin + 2-step login + the random state, saves the (encrypted) refresh
// token, then gives Meet links to upcoming bookings that are still missing one.
import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { hasAdmin2fa } from "@/lib/admin";
import { getSession } from "@/lib/dashboard";
import { notifyMeetLinkReady } from "@/lib/email/notify";
import { finishConnect, retryMissingMeetLinks } from "@/lib/google-calendar";
import { getAdminSupabase } from "@/lib/supabase/admin";

const STATE_COOKIE = "eduvora_gcal_state";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const back = (q: string) => {
    const r = NextResponse.redirect(new URL(`/admin/settings?google=${q}#google-calendar`, request.url));
    r.cookies.delete({ name: STATE_COOKIE, path: "/api/admin/google" });
    r.headers.set("Cache-Control", "private, no-store");
    return r;
  };
  const s = await getSession();
  if (!s || s.profile?.role !== "admin" || !(await hasAdmin2fa(s))) return NextResponse.redirect(new URL("/login?next=/admin/settings", request.url));

  const p = request.nextUrl.searchParams;
  const state = p.get("state") ?? "";
  const saved = request.cookies.get(STATE_COOKIE)?.value ?? "";
  if (!state || !saved || state.length !== saved.length || !timingSafeEqual(Buffer.from(state), Buffer.from(saved))) return back("expired");
  if (p.get("error")) return back("cancelled");
  const code = p.get("code");
  if (!code) return back("failed");

  const res = await finishConnect(code, s.user.id);
  if (!res.ok) return back(`error&msg=${encodeURIComponent(res.error)}`);

  // Activity Log (admin-security.sql) — never the token
  await s.supabase.rpc("log_admin_event", { p_action: "google_calendar.connect", p_summary: `Connected Google Calendar${res.email ? ` (${res.email})` : ""}`, p_details: { google_email: res.email || null } }).then(
    () => null,
    () => null,
  );
  // Upcoming bookings without a Meet link → create them now, and email those students
  after(async () => {
    if (!getAdminSupabase()) return;
    for (const id of await retryMissingMeetLinks(25)) notifyMeetLinkReady(id);
  });
  return back("connected");
}
