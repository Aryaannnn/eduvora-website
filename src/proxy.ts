// Runs before each page request and keeps the student's login session fresh.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { maintenanceAction, maintenanceHtml } from "@/lib/maintenance";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { needsPhone, PHONE_FREE_PATHS, PHONE_OK_COOKIE } from "@/lib/phone";

// Maintenance mode (Admin → Settings): remembered for 15 seconds per server,
// so turning it on/off takes effect within ~15 seconds.
let maintenanceCache: { enabled: boolean; message: string; whatsapp: boolean; until: number } | null = null;
const MAINTENANCE_TTL_MS = 15_000;

// Pages only for logged-in users
const PRIVATE_PATHS = ["/dashboard", "/admin", "/admin-verify", "/invoice", "/payment-success", "/booking-confirmed"];

// Admins are logged out after this long without any activity (also checked in the browser)
const ADMIN_IDLE_MS = 2 * 60 * 60 * 1000;
const ADMIN_SEEN = "eduvora_admin_seen";
const isAdminArea = (p: string) => p === "/admin" || p.startsWith("/admin/");

// At most 2 logged-in devices per student (supabase/secure-reader.sql → enforce_device_limit).
// Checked at most every 2 minutes per browser; the OLDEST login is signed out.
const DEVICE_CHECK = "eduvora_dc";
const DEVICE_CHECK_MS = 2 * 60 * 1000;
const MAX_DEVICES = 2;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the login token if it has expired. Do not remove.
  const { data } = await supabase.auth.getUser();

  // ---------- Maintenance mode ----------
  if (!maintenanceCache || maintenanceCache.until < Date.now()) {
    const { data: m, error } = await supabase.from("maintenance_settings").select("enabled,message").eq("id", 1).maybeSingle();
    // Contact mode (Admin → Settings): WhatsApp button on the maintenance page only in Open mode
    const whatsapp =
      m?.enabled || process.env.MAINTENANCE_MODE === "on"
        ? await supabase.from("contact_settings").select("mode").eq("id", 1).maybeSingle().then((r) => !!r.error || r.data?.mode !== "private", () => true)
        : false;
    // table missing / Supabase hiccup → treat as OFF (never lock everyone out by accident)
    maintenanceCache = { enabled: !error && !!m?.enabled, message: m?.message ?? "", whatsapp, until: Date.now() + MAINTENANCE_TTL_MS };
  }
  // Emergency switch without the database: MAINTENANCE_MODE=on in Vercel (then redeploy)
  if (process.env.MAINTENANCE_MODE === "on") maintenanceCache.enabled = true;
  if (maintenanceCache.enabled) {
    let isStaff = false;
    if (data.user) {
      const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      isStaff = p?.role === "admin" || p?.role === "counsellor";
    }
    const action = maintenanceAction(request.nextUrl.pathname, isStaff);
    if (action !== "allow") {
      const headers = {
        "Retry-After": "1800", // "temporarily unavailable — try again in ~30 minutes"
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex",
      };
      const out =
        action === "api"
          ? NextResponse.json({ error: "We're updating the website. Please try again shortly." }, { status: 503, headers })
          : new NextResponse(maintenanceHtml(maintenanceCache.message, maintenanceCache.whatsapp), { status: 503, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
      response.cookies.getAll().forEach((c) => out.cookies.set(c)); // keep a refreshed login
      return out;
    }
  }

  // Private areas: send logged-out visitors to the login page first
  // (every private page ALSO checks the login itself on the server)
  const path = request.nextUrl.pathname;
  const isPrivate = PRIVATE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  if (!data.user && isPrivate) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  // Logged out → forget the admin activity timer
  if (!data.user && request.cookies.get(ADMIN_SEEN)) response.cookies.delete(ADMIN_SEEN);

  if (data.user) {
    const seen = Number(request.cookies.get(ADMIN_SEEN)?.value ?? 0);
    // Admin area: 2 hours without activity → log out
    if (isAdminArea(path) && seen && Date.now() - seen > ADMIN_IDLE_MS) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?loggedOut=idle&next=${encodeURIComponent(path)}`;
      const out = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => out.cookies.set(c)); // the cleared login cookies
      out.cookies.delete(ADMIN_SEEN);
      out.headers.set("Cache-Control", "private, no-store");
      return out;
    }
    // Admin area needs a 2-step (authenticator app) login
    if (isAdminArea(path)) {
      const { data: c } = await supabase.auth.getClaims();
      if ((c?.claims as { aal?: string } | undefined)?.aal !== "aal2") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin-verify";
        url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
        const to2fa = NextResponse.redirect(url);
        response.cookies.getAll().forEach((ck) => to2fa.cookies.set(ck));
        to2fa.headers.set("Cache-Control", "private, no-store");
        return to2fa;
      }
    }
    // ---------- 2 devices per student ----------
    if (!isAdminArea(path)) {
      const { data: c } = await supabase.auth.getClaims();
      const sid = (c?.claims as { session_id?: string } | undefined)?.session_id;
      const [markSid, markAt] = (request.cookies.get(DEVICE_CHECK)?.value ?? "").split(".");
      if (sid && (markSid !== sid || !(Date.now() - Number(markAt) < DEVICE_CHECK_MS))) {
        const { data: allowed, error } = await supabase.rpc("enforce_device_limit", { p_keep: MAX_DEVICES, p_user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200) || null });
        if (!error && allowed === false) {
          // A newer login on another device pushed this one out → sign it out properly
          await supabase.auth.signOut({ scope: "local" });
          const out = path.startsWith("/api/")
            ? NextResponse.json({ error: "You were logged out because your account was signed in on another device." }, { status: 401 })
            : NextResponse.redirect(Object.assign(request.nextUrl.clone(), { pathname: "/login", search: `?loggedOut=device&next=${encodeURIComponent(path)}` }));
          response.cookies.getAll().forEach((ck) => out.cookies.set(ck)); // the cleared login cookies
          out.cookies.delete(DEVICE_CHECK);
          out.headers.set("Cache-Control", "private, no-store");
          return out;
        }
        // (error = secure-reader.sql not run yet → no limit)
        response.cookies.set(DEVICE_CHECK, `${sid}.${Date.now()}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
      }
    }

    // ---------- Mobile number required (students and parents; not admins / counsellors) ----------
    // Before any page: no valid number → "Complete your profile" (then back to this page).
    // Checked once per account; afterwards a cookie skips the lookup. APIs check again on their own.
    const free = path.startsWith("/api/") || PHONE_FREE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
    if (!free && request.cookies.get(PHONE_OK_COOKIE)?.value !== data.user.id) {
      const { data: p, error } = await supabase.from("profiles").select("role,phone").eq("id", data.user.id).maybeSingle();
      if (!error && p && needsPhone(p)) {
        const url = request.nextUrl.clone();
        url.pathname = "/complete-profile";
        url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
        const out = NextResponse.redirect(url);
        response.cookies.getAll().forEach((ck) => out.cookies.set(ck));
        out.headers.set("Cache-Control", "private, no-store");
        return out;
      }
      if (!error && p) response.cookies.set(PHONE_OK_COOKIE, data.user.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
    }

    // Any activity keeps an admin's timer fresh (started on their first admin page)
    if (isAdminArea(path) || seen) response.cookies.set(ADMIN_SEEN, String(Date.now()), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
  }

  // Private pages must not be kept by the browser (so "Back" after logout can't show them)
  if (isPrivate) response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const config = {
  // Skip images, fonts and other static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf)$).*)"],
};
