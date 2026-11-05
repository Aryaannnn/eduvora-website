// POST /auth/logout — signs the user out ON THE SERVER:
//  • ends the Supabase session (this device), and
//  • deletes the login cookies, so private pages can no longer be opened.
// The browser then goes to /login?loggedOut=1 (see src/lib/useLogout.ts).
import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await getServerSupabase();
  if (supabase) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  // Belt and braces: remove every Supabase login cookie (sb-…-auth-token, incl. split ".0/.1" parts)
  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith("sb-")) res.cookies.set(c.name, "", { path: "/", expires: new Date(0) });
  }
  return res;
}
