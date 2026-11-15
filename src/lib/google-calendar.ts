// =====================================================================
//  GOOGLE CALENDAR — SERVER ONLY (counselling is a voice call)
//
//  Admin → Settings → "Connect Google Calendar" connects ONE Google account
//  (eduvora.support@gmail.com) once. We keep its refresh token ENCRYPTED in
//  public.google_calendar_connection (only the server's service role can
//  read that table — supabase/google-calendar.sql).
//
//  syncBookingCalendar(id) makes the calendar match the booking:
//    confirmed  → event "Voice call – EDUVORA counselling (30 min)" at the
//                 right time, the student's number in the description, and
//                 the student invited as a guest (Google emails them)
//    cancelled  → event cancelled (Google tells the student)
//  It never throws. If Google is not connected or fails, the booking is
//  still confirmed and the emails go out as normal.
//
//  Needs (server-only, never NEXT_PUBLIC_): GOOGLE_CALENDAR_CLIENT_ID,
//  GOOGLE_CALENDAR_CLIENT_SECRET — see README "Google Calendar".
// =====================================================================
import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";
import { formatPhoneIN } from "./format";
import { getAdminSupabase } from "./supabase/admin";
import { reportFailure } from "./monitor";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const clientId = () => (process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "").trim();
const clientSecret = () => (process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "").trim();
export const isCalendarConfigured = () => clientId().length > 10 && clientSecret().length > 10;
export const calendarRedirectUri = () => `${siteConfig.siteUrl}/api/admin/google/callback`;

// ---------------------------------------------------------------------
//  Encryption of the refresh token (AES-256-GCM). The key is derived from
//  the client secret, which lives only in the server's environment — so a
//  copy of the database alone can't be used to read the calendar.
// ---------------------------------------------------------------------
function key() {
  return Buffer.from(hkdfSync("sha256", clientSecret(), "eduvora-google-calendar", "refresh-token-v1", 32));
}
function encrypt(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
}
function decrypt(blob: string): string | null {
  try {
    const [v, iv, tag, body] = blob.split(".");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null; // wrong key (client secret changed) → admin reconnects
  }
}

// ---------------------------------------------------------------------
//  Connecting (OAuth) — used by /api/admin/google/connect + callback
// ---------------------------------------------------------------------
export function googleAuthUrl(state: string) {
  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId(),
    redirect_uri: calendarRedirectUri(),
    response_type: "code",
    scope: `openid email ${CALENDAR_SCOPE}`,
    access_type: "offline", // → refresh token, so it keeps working
    prompt: "consent", // always give a fresh refresh token
    login_hint: siteConfig.email,
    state,
  })}`;
}

/** Code from Google → save the encrypted refresh token. Returns the Google email. */
export async function finishConnect(code: string, adminId: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const db = getAdminSupabase();
  if (!db) return { ok: false, error: "The server key is missing." };
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId(), client_secret: clientSecret(), redirect_uri: calendarRedirectUri(), grant_type: "authorization_code" }),
    cache: "no-store",
  });
  const t = (await res.json().catch(() => ({}))) as { refresh_token?: string; access_token?: string; scope?: string; id_token?: string; error_description?: string };
  if (!res.ok || !t.access_token) return { ok: false, error: t.error_description || "Google did not accept the connection. Please try again." };
  if (!(t.scope ?? "").split(" ").includes(CALENDAR_SCOPE)) {
    return { ok: false, error: "Please tick the box that lets EDUVORA \"view and edit events on your calendars\", then try again." };
  }
  if (!t.refresh_token) return { ok: false, error: "Google did not send a long-term key. Please try again." };
  // The id_token came straight from Google over HTTPS — we only read the email from it.
  let email = "";
  try {
    email = String(JSON.parse(Buffer.from((t.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8")).email ?? "");
  } catch {
    /* email is only for display */
  }
  const { error } = await db.from("google_calendar_connection").upsert({
    id: 1,
    google_email: email || null,
    refresh_token_encrypted: encrypt(t.refresh_token),
    scopes: t.scope ?? null,
    connected_by: adminId,
    connected_at: new Date().toISOString(),
    last_error: null,
    last_error_at: null,
  });
  if (error) {
    return { ok: false, error: /google_calendar_connection/.test(error.message) ? "Run supabase/google-calendar.sql in Supabase first." : "Could not save the connection." };
  }
  cachedToken = null;
  return { ok: true, email };
}

export type CalendarConnection = { connected: boolean; email: string | null; connectedAt: string | null; lastError: string | null; setupMissing: boolean; configured: boolean };

/** For Admin → Settings (never includes the token). */
export async function getCalendarConnection(): Promise<CalendarConnection> {
  const configured = isCalendarConfigured();
  const db = getAdminSupabase();
  if (!db) return { connected: false, email: null, connectedAt: null, lastError: null, setupMissing: false, configured };
  const { data, error } = await db.from("google_calendar_connection").select("google_email,connected_at,last_error").eq("id", 1).maybeSingle();
  if (error) return { connected: false, email: null, connectedAt: null, lastError: null, setupMissing: true, configured };
  return { connected: !!data, email: data?.google_email ?? null, connectedAt: data?.connected_at ?? null, lastError: data?.last_error ?? null, setupMissing: false, configured };
}

export async function disconnectCalendar() {
  const db = getAdminSupabase();
  if (!db) return;
  const { data } = await db.from("google_calendar_connection").select("refresh_token_encrypted").eq("id", 1).maybeSingle();
  const token = data ? decrypt(data.refresh_token_encrypted) : null;
  if (token) {
    // Also remove the access on Google's side
    await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) }).catch(() => null);
  }
  await db.from("google_calendar_connection").delete().eq("id", 1);
  cachedToken = null;
}

// ---------------------------------------------------------------------
//  Access token (refreshed from the saved refresh token, kept ~55 min)
// ---------------------------------------------------------------------
let cachedToken: { token: string; until: number } | null = null;

class NotConnected extends Error {}

async function accessToken(db: SupabaseClient): Promise<string> {
  if (cachedToken && cachedToken.until > Date.now()) return cachedToken.token;
  if (!isCalendarConfigured()) throw new NotConnected("Google Calendar keys are not set on the server.");
  const { data, error } = await db.from("google_calendar_connection").select("refresh_token_encrypted").eq("id", 1).maybeSingle();
  if (error || !data) throw new NotConnected("Google Calendar is not connected.");
  const refresh = decrypt(data.refresh_token_encrypted);
  if (!refresh) {
    await markConnectionError(db, "The saved Google key can't be read (the client secret changed?). Please reconnect.");
    throw new NotConnected("Google Calendar needs to be reconnected.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), refresh_token: refresh, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  const t = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !t.access_token) {
    if (t.error === "invalid_grant") {
      await markConnectionError(db, "Google removed the access (password changed, access removed, or the app is still in \"Testing\"). Please reconnect.");
      throw new NotConnected("Google Calendar needs to be reconnected.");
    }
    throw new Error(`Google sign-in failed (${res.status}).`);
  }
  cachedToken = { token: t.access_token, until: Date.now() + Math.max(60, (t.expires_in ?? 3600) - 300) * 1000 };
  if (data) await db.from("google_calendar_connection").update({ last_error: null, last_error_at: null }).eq("id", 1).not("last_error", "is", null);
  return t.access_token;
}

async function markConnectionError(db: SupabaseClient, msg: string) {
  cachedToken = null;
  await db.from("google_calendar_connection").update({ last_error: msg, last_error_at: new Date().toISOString() }).eq("id", 1);
}

async function gapi(db: SupabaseClient, path: string, init: { method: string; body?: unknown }) {
  const token = await accessToken(db);
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json: json as GEvent & { error?: { message?: string } } };
}

type GEvent = { id?: string; status?: string };

// ---------------------------------------------------------------------
//  Booking ↔ event
// ---------------------------------------------------------------------
type CalBooking = {
  id: string; user_id: string | null; name: string; phone: string; email: string | null; message: string | null; class_year: string | null;
  expected_marks: number | null; status: string; calendar_event_id: string | null; calendar_status: string | null;
  slots: { date: string; start_time: string; end_time: string } | null;
};

/** Same id every time for a booking → a repeated call can never make a 2nd event. (Google allows a–v and 0–9.) */
const eventIdFor = (bookingId: string) => `edv${bookingId.replace(/-/g, "").toLowerCase()}`;

/** A voice call. The student's number is in the description. */
function eventBody(b: CalBooking) {
  const ref = b.id.slice(0, 8).toUpperCase();
  const lines = [
    `30-minute one-to-one VITEEE counselling voice call with ${siteConfig.founder.name} (${siteConfig.businessName}).`,
    `Call the student on: ${formatPhoneIN(b.phone)}`,
    "",
    `Student: ${b.name}`,
    b.class_year ? `Class / year: ${b.class_year}` : "",
    b.expected_marks !== null && b.expected_marks !== undefined ? `Expected VITEEE marks: ${+b.expected_marks} / 125` : "",
    b.message ? `Message: ${b.message}` : "",
    "",
    `Booking ID: ${ref}`,
    `${siteConfig.siteUrl}/dashboard/bookings`,
  ].filter((l, i, a) => l !== "" || (a[i - 1] ?? "") !== "");
  const t = (s: string) => s.slice(0, 8);
  return {
    summary: `Voice call – ${siteConfig.businessName} counselling (30 min) — ${b.name}`,
    description: lines.join("\n"),
    start: { dateTime: `${b.slots!.date}T${t(b.slots!.start_time)}`, timeZone: "Asia/Kolkata" },
    end: { dateTime: `${b.slots!.date}T${t(b.slots!.end_time)}`, timeZone: "Asia/Kolkata" },
    attendees: b.email ? [{ email: b.email, displayName: b.name }] : [],
    guestsCanInviteOthers: false,
    guestsCanSeeOtherGuests: false,
    reminders: { useDefault: true },
    extendedProperties: { private: { bookingId: b.id } },
    status: "confirmed",
  };
}

const BOOKING_COLS = "id,user_id,name,phone,email,message,class_year,expected_marks,status,calendar_event_id,calendar_status,slots(date,start_time,end_time)";

export type SyncResult = { result: "created" | "updated" | "cancelled" | "skipped" | "not_connected" | "failed" | "setup_missing" };

/**
 * Make Google Calendar match this booking. Never throws; the result is
 * also saved on the booking (calendar_status / calendar_error).
 */
export async function syncBookingCalendar(bookingId: string): Promise<SyncResult> {
  const db = getAdminSupabase();
  if (!db) return { result: "skipped" };
  const { data, error } = await db.from("bookings").select(BOOKING_COLS).eq("id", bookingId).maybeSingle();
  if (error) {
    if (error.code === "42703") return { result: "setup_missing" }; // SQL not run yet
    return { result: "failed" };
  }
  if (!data) return { result: "skipped" };
  const b = data as unknown as CalBooking;
  // Students' own email when the booking form email was left empty
  if (!b.email && b.user_id) {
    const { data: p } = await db.from("profiles").select("email").eq("id", b.user_id).maybeSingle();
    b.email = (p?.email as string | null) ?? null;
  }
  const save = (patch: Record<string, unknown>) => db.from("bookings").update({ ...patch, calendar_synced_at: new Date().toISOString() }).eq("id", b.id);

  try {
    // ---- cancelled / expired → cancel the event
    if (["cancelled", "expired"].includes(b.status)) {
      if (!b.calendar_event_id) return { result: "skipped" };
      const r = await gapi(db, `/${encodeURIComponent(b.calendar_event_id)}?sendUpdates=all`, { method: "DELETE" });
      if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(r.json.error?.message || `Google error ${r.status}`);
      await save({ calendar_event_id: null, calendar_status: "cancelled", calendar_error: null });
      return { result: "cancelled" };
    }
    if (b.status !== "confirmed" || !b.slots) return { result: "skipped" };

    // ---- confirmed → create or update the calendar event (voice call)
    const id = b.calendar_event_id ?? eventIdFor(b.id);
    let created = false;
    if (!b.calendar_event_id) {
      const r = await gapi(db, `?sendUpdates=all`, { method: "POST", body: { id, ...eventBody(b) } });
      if (r.ok) created = true;
      else if (r.status === 409) await updateEvent(db, b, id); // made before (e.g. re-confirmed after a cancel)
      else throw new Error(r.json.error?.message || `Google error ${r.status}`);
    } else {
      await updateEvent(db, b, id);
    }
    await save({ calendar_event_id: id, calendar_status: "ok", calendar_error: null });
    return { result: created ? "created" : "updated" };
  } catch (e) {
    const notConnected = e instanceof NotConnected;
    const msg = (e as Error).message.slice(0, 300);
    if (!notConnected) reportFailure("calendar", "Google Calendar sync failed", msg, { booking: b.id.slice(0, 8) });
    if (["cancelled", "expired"].includes(b.status)) {
      await save({ calendar_error: `Could not cancel the calendar event: ${msg}` });
    } else {
      await save({ calendar_status: notConnected ? "not_connected" : "failed", calendar_error: msg });
    }
    return { result: notConnected ? "not_connected" : "failed" };
  }
}

/** Existing event → new time/details. */
async function updateEvent(db: SupabaseClient, b: CalBooking, id: string): Promise<void> {
  const r = await gapi(db, `/${encodeURIComponent(id)}?sendUpdates=all`, { method: "PATCH", body: eventBody(b) });
  if (!r.ok) throw new Error(r.json.error?.message || `Google error ${r.status}`);
}

/** Remove events of a deleted account from the calendar (no emails — the account is gone). */
export async function deleteEventsQuietly(eventIds: string[]) {
  const db = getAdminSupabase();
  if (!db || !eventIds.length) return;
  for (const id of eventIds) {
    try {
      await gapi(db, `/${encodeURIComponent(id)}?sendUpdates=none`, { method: "DELETE" });
    } catch {
      /* not connected — nothing to remove */
    }
  }
}

/**
 * Upcoming confirmed bookings that are not in Google Calendar yet (it was not
 * connected, or failed) → try again. Run by the reminders cron and right after
 * connecting. Returns how many were added.
 */
export async function retryMissingCalendarEvents(limit = 10): Promise<number> {
  const db = getAdminSupabase();
  if (!db) return 0;
  const conn = await db.from("google_calendar_connection").select("id,last_error").eq("id", 1).maybeSingle();
  if (conn.error || !conn.data || conn.data.last_error) return 0;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const { data } = await db
    .from("bookings")
    .select("id,slots!inner(date)")
    .eq("status", "confirmed")
    .is("calendar_event_id", null)
    .or("calendar_status.is.null,calendar_status.in.(failed,not_connected)") // null = booked before Calendar was connected
    .gte("slots.date", today)
    .limit(limit);
  let added = 0;
  for (const b of data ?? []) {
    const r = await syncBookingCalendar(b.id);
    if (r.result === "created" || r.result === "updated") added++;
  }
  return added;
}
