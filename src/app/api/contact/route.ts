// GET /api/contact — the number for whoever may see it (Contact mode: Open = everyone,
// Private = paid students and admins). Everyone else gets { unlocked: false } — no number.
import { NextResponse } from "next/server";
import { getContactAccess } from "@/lib/contact";

export async function GET() {
  const access = await getContactAccess();
  const body = access.unlocked
    ? { unlocked: true, phone: access.display, tel: `tel:${access.tel}`, whatsapp: `https://wa.me/${access.whatsappDigits}` }
    : { unlocked: false };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
