// /go/whatsapp?text=... — every "WhatsApp" button on the site points here.
// The server checks if this visitor has paid:
//   paid (or admin) → sent straight to WhatsApp with your real number
//   not paid        → sent to the /unlock page (the number is never revealed)
import { NextResponse, type NextRequest } from "next/server";
import { getContactAccess } from "@/lib/contact";

export async function GET(request: NextRequest) {
  const text = (request.nextUrl.searchParams.get("text") ?? "").slice(0, 1500);
  const access = await getContactAccess();

  const target = access.unlocked
    ? `https://wa.me/${access.whatsappDigits}${text ? `?text=${encodeURIComponent(text)}` : ""}`
    : new URL(`/unlock?via=whatsapp${text ? `&msg=${encodeURIComponent(text)}` : ""}`, request.url).toString();

  const res = NextResponse.redirect(target, 307);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
