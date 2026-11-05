// Links from Supabase land here: Google sign-in, email confirmation and password reset.
// We swap the one-time code for a login session, then go to the right page.
import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const isReset = next.startsWith("/reset-password");

  // Where to send people when the link didn't work (expired, already used, opened elsewhere)
  const failed = () => NextResponse.redirect(isReset ? `${origin}/reset-password?error=expired` : `${origin}/login?error=link`);

  // Supabase adds ?error=…&error_code=otp_expired when a link has expired
  if (searchParams.get("error") || searchParams.get("error_code")) return failed();

  if (code) {
    const supabase = await getServerSupabase();
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? { error: true };
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return failed();
}
