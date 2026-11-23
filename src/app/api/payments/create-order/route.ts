// POST /api/payments/create-order   body: { productId }
// 1. Must be logged in (otherwise 401 → the button sends them to login)
// 2. Reads the PRICE FROM OUR DATABASE (never from the browser)
// 3. Free item → unlocked straight away, no payment
// 4. Paid item → works out the price ON THE SERVER (coupon, referral ₹ off,
//    reward credit — src/lib/pricing.ts), creates the Razorpay order for
//    that amount + saves a 'created' purchase with the discount details
import { productAccess } from "@/lib/access";
import { phoneRequired } from "@/lib/phone-guard";
import { countEnrolled, seatLimitOf } from "@/lib/seats";
import { after, NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { welcomeIfNew } from "@/lib/email/notify";
import { unlockFreeProduct } from "@/lib/free-resources";
import { claimReferralFromCookie, discountColumns, quote, recordCouponUse } from "@/lib/pricing";
import { sweepStalePayments } from "@/lib/payments-server";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/razorpay";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { reportFailure } from "@/lib/monitor";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  const { productId, coupon } = (await request.json().catch(() => ({}))) as { productId?: unknown; coupon?: unknown };
  if (typeof productId !== "string" || !/^[0-9a-f-]{36}$/i.test(productId)) return json({ error: "Invalid product." }, 400);

  const session = await getSession();
  if (!session) return json({ error: "Please log in to buy.", login: true }, 401);
  const noPhone = phoneRequired(session); // students must add a mobile number first (also for free items)
  if (noPhone) return noPhone;
  welcomeIfNew(session.user.id);

  const admin = getAdminSupabase();
  if (!admin) return json({ error: "Payments are not set up yet. Please try again later." }, 503);

  const { data: product } = await admin
    .from("products")
    .select("id,title,slug,price,is_free,is_active,category,details")
    .eq("id", productId)
    .maybeSingle();
  if (!product || !product.is_active) return json({ error: "This item is not available." }, 404);

  // Already bought (and access not ended)? Never charge twice.
  // Access ended → buy again only if renewals are on for this product (supabase/access-periods.sql).
  const paidQ = (cols: string) => admin.from("purchases").select(cols).eq("user_id", session.user.id).eq("product_id", product.id).eq("status", "paid");
  let paidRes = await paidQ("id,access_until");
  if (paidRes.error) paidRes = await paidQ("id"); // SQL not run yet
  const rows = (paidRes.data ?? []) as unknown as { id: string; access_until?: string | null }[];
  const owned = rows.find((r) => !r.access_until || new Date(r.access_until).getTime() > Date.now()) ?? null;
  if (!owned && rows.length && !productAccess(product.details).renewals) {
    return json({ error: "Your access to this item has ended. Please contact us to renew it." }, 409);
  }
  if (owned) {
    const redirect = product.category === "counselling_package" ? "/book-a-slot" : product.is_free ? `/dashboard/courses?unlocked=${product.id}#item-${product.id}` : `/dashboard/courses?open=${product.id}#item-${product.id}`;
    return json({ owned: true, redirect });
  }

  // Batch full? (seat limit set in Admin → Products; counts real, paid enrolments)
  const limit = seatLimitOf(product.details as { seat_limit?: unknown } | null);
  if (limit) {
    const taken = await countEnrolled(admin, product.id);
    if (taken !== null && taken >= limit) return json({ error: "Sorry, enrolment for this course is full. Send us an enquiry or email us to join the waiting list." }, 409);
  }

  // FREE items unlock immediately (amount 0, no Razorpay)
  if (product.is_free || product.price <= 0) {
    const id = await unlockFreeProduct(admin, session.user.id, product.id);
    if (!id) return json({ error: "Could not unlock this item. Please try again." }, 500);
    // Straight to My Courses & Material, with this item highlighted
    return json({ free: true, redirect: `/dashboard/courses?unlocked=${product.id}#item-${product.id}` });
  }

  if (!isRazorpayConfigured()) return json({ error: "Payments are not set up yet. Please try again later." }, 503);

  // The real price: coupon + referral discount + reward credit (all checked here)
  await claimReferralFromCookie(admin, session.user.id);
  const q = await quote(admin, session.user.id, { kind: "product", id: product.id, price: product.price }, coupon);
  if (q.couponError) return json({ error: q.couponError, couponError: true }, 400);

  let order;
  try {
    order = await createRazorpayOrder(q.final, `p_${product.id.slice(0, 8)}_${Date.now()}`, {
      product_id: product.id,
      product: product.title.slice(0, 200),
      user_id: session.user.id,
    });
  } catch (e) {
    reportFailure("payment", "Razorpay order could not be created", e);
    return json({ error: "Could not start the payment. Please try again in a minute." }, 502);
  }

  // Saved as a HIDDEN attempt ('created'): needed for the signature check and
  // the webhook, but never shown in payment lists until it is paid or failed.
  const attempt = { user_id: session.user.id, product_id: product.id, amount: q.final, razorpay_order_id: order.id, ...discountColumns(q) };
  let { data: saved, error } = await admin.from("purchases").insert({ ...attempt, status: "created" }).select("id").single();
  // Older database without the 'created' status (payment-statuses.sql not run yet)
  if (error && /status_check/.test(error.message)) ({ data: saved, error } = await admin.from("purchases").insert({ ...attempt, status: "pending" }).select("id").single());
  if (error) {
    reportFailure("payment", "Could not save the payment attempt", error.message);
    return json({ error: "Could not start the payment. Please try again." }, 500);
  }

  if (saved) await recordCouponUse(admin, session.user.id, q, { purchaseId: saved.id as string });

  // Background tidy-up of old unpaid orders (doesn't slow this request down)
  after(() => sweepStalePayments(admin, { limit: 10 }).catch(() => {}));

  const p = session.profile;
  return json({
    orderId: order.id,
    amount: order.amount, // in paise (₹1 = 100 paise)
    currency: order.currency,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    title: product.title,
    prefill: {
      name: p?.full_name ?? "",
      email: p?.email ?? session.user.email ?? "",
      contact: (p?.phone ?? session.user.phone ?? "").replace(/[^\d+]/g, ""),
    },
  });
}
