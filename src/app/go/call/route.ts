// /go/call — every "Call Now" button on the site points here.
//   paid (or admin) → opens the phone dialer with your real number
//   not paid        → sent to the /unlock page (the number is never revealed)
import { NextResponse, type NextRequest } from "next/server";
import { getContactAccess } from "@/lib/contact";

export async function GET(request: NextRequest) {
  const access = await getContactAccess();
  const target = access.unlocked ? `tel:${access.tel}` : new URL("/unlock?via=call", request.url).toString();
  const res = NextResponse.redirect(target, 307);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
