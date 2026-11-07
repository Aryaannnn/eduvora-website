// Links from Supabase land here: Google sign-in, email confirmation and password reset.
// We swap the one-time code for a login session, then go to the right page.
import { NextResponse, type NextRequest } from "next/server";
import { welcomeIfNew } from "@/lib/email/notify";
import { claimReferralFromCookie } from "@/lib/pricing";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { serverOrigin } from "@/lib/site-url";
import { getServerSupabase } from "@/lib/supabase/server";
import { reportFailure } from "@/lib/monitor";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = serverOrigin(request.nextUrl.origin); // NEXT_PUBLIC_SITE_URL when set
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const isReset = next.startsWith("/reset-password");

  // Where to send people when the link didn't work (expired, already used, opened elsewhere)
  const failed = () => NextResponse.redirect(isReset ? `${origin}/reset-password?error=expired` : `${origin}/login?error=link`);

  // Supabase adds ?error=…&error_code=otp_expired when a link has expired
  const errCode = searchParams.get("error_code") ?? "";
  if (searchParams.get("error") || errCode) {
    // Expired / already-used links are normal; anything else (e.g. Google sign-in set up wrong) is reported
    if (!/otp_expired|flow_state|access_denied|bad_code/i.test(`${errCode} ${searchParams.get("error")}`)) {
      reportFailure("login", `Sign-in link / Google sign-in returned an error: ${searchParams.get("error") ?? ""} ${errCode}`.trim());
    }
    return failed();
  }

  if (code) {
    const supabase = await getServerSupabase();
    const res = supabase ? await supabase.auth.exchangeCodeForSession(code) : null;
    if (res?.error && (res.error.status ?? 0) >= 500) reportFailure("login", "Could not finish sign-in (Supabase error)", res.error.message);
    if (res && !res.error) {
      // New students get the welcome email once (the profile itself is made by the database trigger)
      if (res.data.user) {
        welcomeIfNew(res.data.user.id);
        await claimReferralFromCookie(getAdminSupabase(), res.data.user.id); // joined through a friend's link?
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return failed();
}
