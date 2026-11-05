// POST /api/payments/create-order   body: { productId }
// 1. Must be logged in (otherwise 401 → the button sends them to login)
// 2. Reads the PRICE FROM OUR DATABASE (never from the browser)
// 3. Free item → unlocked straight away, no payment
// 4. Paid item → creates a Razorpay order + saves a 'pending' purchase
import { after, NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { welcomeIfNew } from "@/lib/email/notify";
import { sweepStalePayments } from "@/lib/payments-server";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/razorpay";
import { getAdminSupabase } from "@/lib/supabase/admin";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  const { productId } = (await request.json().catch(() => ({}))) as { productId?: unknown };
  if (typeof productId !== "string" || !/^[0-9a-f-]{36}$/i.test(productId)) return json({ error: "Invalid product." }, 400);

  const session = await getSession();
  if (!session) return json({ error: "Please log in to buy.", login: true }, 401);
  welcomeIfNew(session.user.id);

  const admin = getAdminSupabase();
  if (!admin) return json({ error: "Payments are not set up yet. Please try again later." }, 503);

  const { data: product } = await admin
    .from("products")
    .select("id,title,slug,price,is_free,is_active,category")
    .eq("id", productId)
    .maybeSingle();
  if (!product || !product.is_active) return json({ error: "This item is not available." }, 404);

  // Already bought? Never charge twice.
  const { data: owned } = await admin
    .from("purchases")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("product_id", product.id)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();
  if (owned) return json({ owned: true, redirect: "/dashboard/courses" });

  // FREE items unlock immediately (amount 0, no Razorpay)
  if (product.is_free || product.price <= 0) {
    const row = { user_id: session.user.id, product_id: product.id, amount: 0, status: "paid" };
    let { data: free, error } = await admin.from("purchases").insert({ ...row, paid_at: new Date().toISOString() }).select("id").single();
    // paid_at only exists after supabase/payments.sql — still unlock without it
    if (error && /paid_at/.test(error.message)) ({ data: free, error } = await admin.from("purchases").insert(row).select("id").single());
    if (error) {
      console.warn("[payments] free unlock failed:", error.message);
      return json({ error: "Could not unlock this item. Please try again." }, 500);
    }
    return json({ free: true, redirect: `/payment-success?id=${free!.id}` });
  }

  if (!isRazorpayConfigured()) return json({ error: "Payments are not set up yet. Please try again later." }, 503);

  let order;
  try {
    order = await createRazorpayOrder(product.price, `p_${product.id.slice(0, 8)}_${Date.now()}`, {
      product_id: product.id,
      product: product.title.slice(0, 200),
      user_id: session.user.id,
    });
  } catch (e) {
    console.warn("[payments]", (e as Error).message);
    return json({ error: "Could not start the payment. Please try again in a minute." }, 502);
  }

  // Saved as a HIDDEN attempt ('created'): needed for the signature check and
  // the webhook, but never shown in payment lists until it is paid or failed.
  const attempt = { user_id: session.user.id, product_id: product.id, amount: product.price, razorpay_order_id: order.id };
  let { error } = await admin.from("purchases").insert({ ...attempt, status: "created" });
  // Older database without the 'created' status (payment-statuses.sql not run yet)
  if (error && /status_check/.test(error.message)) ({ error } = await admin.from("purchases").insert({ ...attempt, status: "pending" }));
  if (error) {
    console.warn("[payments] could not save pending purchase:", error.message);
    return json({ error: "Could not start the payment. Please try again." }, 500);
  }

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
