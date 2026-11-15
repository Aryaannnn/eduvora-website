// /go/call — every "Call" button that doesn't know the number points here.
// Follows Admin → Settings → Contact mode:
//   Open    → the phone dialer for everyone
//   Private → paid students & admins: the phone dialer · everyone else: the free enquiry form
import { NextResponse, type NextRequest } from "next/server";
import { getContactAccess } from "@/lib/contact";

export async function GET(request: NextRequest) {
  const access = await getContactAccess();
  const target = access.unlocked ? `tel:${access.tel}` : new URL("/contact#enquiry", request.url).toString();
  const res = NextResponse.redirect(target, 307);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
