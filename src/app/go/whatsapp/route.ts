// /go/whatsapp?text=... — WhatsApp buttons that don't know the number point here.
// Follows Admin → Settings → Contact mode:
//   Open    → WhatsApp for everyone, with the message ready to send
//   Private → only paid students and admins; everyone else → the free enquiry form
// The number is added here on the server, so it isn't written in the page.
import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { getContactAccess } from "@/lib/contact";

export async function GET(request: NextRequest) {
  const text = (request.nextUrl.searchParams.get("text") || siteConfig.whatsappMessage).slice(0, 1500);
  const access = await getContactAccess();
  const target = access.unlocked
    ? `https://wa.me/${access.whatsappDigits}?text=${encodeURIComponent(text)}`
    : new URL("/contact#enquiry", request.url).toString();
  const res = NextResponse.redirect(target, 307);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
