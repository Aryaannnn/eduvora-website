// Runs before each page request and keeps the student's login session fresh.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

// Pages only for logged-in users
const PRIVATE_PATHS = ["/dashboard", "/admin", "/admin-verify", "/invoice", "/payment-success", "/booking-confirmed"];

// Admins are logged out after this long without any activity (also checked in the browser)
const ADMIN_IDLE_MS = 2 * 60 * 60 * 1000;
const ADMIN_SEEN = "eduvora_admin_seen";
const isAdminArea = (p: string) => p === "/admin" || p.startsWith("/admin/");

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
