// Runs before each page request and keeps the student's login session fresh.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

// Pages only for logged-in users
const PRIVATE_PATHS = ["/dashboard", "/admin", "/invoice", "/payment-success", "/booking-confirmed"];

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
  // Private pages must not be kept by the browser (so "Back" after logout can't show them)
  if (isPrivate) response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const config = {
  // Skip images, fonts and other static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf)$).*)"],
};
