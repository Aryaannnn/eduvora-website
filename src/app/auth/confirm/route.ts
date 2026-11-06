// OPTIONAL link handler that also works when the email is opened on ANOTHER device.
// Used only if you change the "Reset Password" email template in Supabase to:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
// (see SUPABASE_SETUP.md). Without that change, /auth/callback is used instead.
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { serverOrigin } from "@/lib/site-url";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = serverOrigin(request.nextUrl.origin); // NEXT_PUBLIC_SITE_URL when set
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (tokenHash && type) {
    const supabase = await getServerSupabase();
    const { error } = (await supabase?.auth.verifyOtp({ type, token_hash: tokenHash })) ?? { error: true };
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(type === "recovery" ? `${origin}/reset-password?error=expired` : `${origin}/login?error=link`);
}
