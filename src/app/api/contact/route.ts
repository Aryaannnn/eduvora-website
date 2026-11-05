// GET /api/contact — returns the full number ONLY to paid students and admins.
// Everyone else gets { unlocked: false } plus the masked number.
import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { getContactAccess } from "@/lib/contact";

export async function GET() {
  const access = await getContactAccess();
  const body = access.unlocked
    ? { unlocked: true, phone: access.display, tel: `tel:${access.tel}`, whatsapp: `https://wa.me/${access.whatsappDigits}` }
    : { unlocked: false, phone: siteConfig.phoneMasked };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
