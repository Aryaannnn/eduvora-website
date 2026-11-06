// /go/whatsapp?text=... — every "WhatsApp" button on the site points here.
// WhatsApp chat is open to EVERYONE (logged in or not): the visitor is sent
// straight to WhatsApp with the message ready to send.
// The number is added here on the server, so it isn't written in the page.
// (Direct CALLS stay locked for unpaid visitors — see /go/call.)
import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { whatsappDigits } from "@/lib/contact";

export async function GET(request: NextRequest) {
  const text = (request.nextUrl.searchParams.get("text") || siteConfig.whatsappMessage).slice(0, 1500);
  const digits = whatsappDigits();

  // Number not set up yet → the enquiry form instead
  const target = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : new URL("/contact#contact", request.url).toString();

  const res = NextResponse.redirect(target, 307);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
