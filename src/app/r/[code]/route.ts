// /r/<code> — a student's personal referral link.
// Remembers the code for 30 days (cookie) and opens Sign Up. When the new
// student logs in, the server links them to the referrer (claim_referral in
// supabase/coupons-referrals.sql checks: new account, not themselves, nothing paid yet).
import { NextResponse, type NextRequest } from "next/server";
import { normaliseCode, REF_COOKIE } from "@/lib/pricing";

export async function GET(request: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const code = normaliseCode((await ctx.params).code);
  const target = new URL(code ? `/login?mode=signup&ref=${encodeURIComponent(code)}` : "/login?mode=signup", request.url);
  const res = NextResponse.redirect(target);
  if (/^[A-Z0-9]{4,30}$/.test(code)) {
    res.cookies.set(REF_COOKIE, code, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  }
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
