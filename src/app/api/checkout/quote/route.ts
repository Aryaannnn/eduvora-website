// POST /api/checkout/quote   body: { productId } or { slotId }, plus optional { coupon }
// → the price breakdown the student will pay (coupon, referral ₹ off, reward credit).
// Shown in the checkout box. The real order is priced AGAIN on the server
// when they click Pay, so nothing here can be faked.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { claimReferralFromCookie, quote } from "@/lib/pricing";
import { getAdminSupabase } from "@/lib/supabase/admin";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const session = await getSession();
  if (!session) return json({ error: "Please log in.", login: true }, 401);
  const db = getAdminSupabase();
  if (!db) return json({ error: "Checkout is not available right now." }, 503);
  await claimReferralFromCookie(db, session.user.id);

  if (isId(b.productId)) {
    const { data: p } = await db.from("products").select("id,title,price,is_free,is_active").eq("id", b.productId).maybeSingle();
    if (!p || !p.is_active) return json({ error: "This item is not available." }, 404);
    const q = await quote(db, session.user.id, { kind: "product", id: p.id, price: p.is_free ? 0 : p.price }, b.coupon);
    return json({ title: p.title, ...q, coupon: q.coupon && { code: q.coupon.code, discount: q.coupon.discount } });
  }
  if (isId(b.slotId)) {
    const { data: s } = await db.from("slots").select("id,price,is_available").eq("id", b.slotId).maybeSingle();
    if (!s) return json({ error: "This slot is not available." }, 404);
    const q = await quote(db, session.user.id, { kind: "slot", id: s.id, price: s.price }, b.coupon);
    return json({ title: "One-to-one counselling session", ...q, coupon: q.coupon && { code: q.coupon.code, discount: q.coupon.discount } });
  }
  return json({ error: "Nothing to check out." }, 400);
}
