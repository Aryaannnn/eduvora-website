// POST /api/payments/verify — called by the browser right after Razorpay says "paid".
// We check Razorpay's signature with our SECRET key. Only if it is valid do we
// mark the purchase 'paid', give it an invoice number (EDU-2026-0001) and
// unlock the item. A fake "success" sent from a browser cannot pass this check.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { markPurchasePaid } from "@/lib/payments-server";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { reportFailure } from "@/lib/monitor";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const orderId = typeof b.razorpay_order_id === "string" ? b.razorpay_order_id : "";
  const paymentId = typeof b.razorpay_payment_id === "string" ? b.razorpay_payment_id : "";
  const signature = typeof b.razorpay_signature === "string" ? b.razorpay_signature : "";

  const session = await getSession();
  if (!session) return json({ error: "Please log in again." }, 401);
  const admin = getAdminSupabase();
  if (!admin) return json({ error: "Payments are not set up." }, 503);

  // The order must belong to this student
  const { data: purchase } = await admin.from("purchases").select("id,user_id,status").eq("razorpay_order_id", orderId).maybeSingle();
  if (!purchase || purchase.user_id !== session.user.id) return json({ error: "Order not found." }, 404);

  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    // Not marked 'failed' here: only Razorpay decides that. The automatic
    // check asks Razorpay what really happened to this order.
    reportFailure("payment", "Payment signature check failed", undefined, { purchase: purchase.id.slice(0, 8) });
    return json({ error: "We could not verify this payment." }, 400);
  }

  const saved = await markPurchasePaid(admin, orderId, paymentId);
  if (saved.error) {
    // The money IS with Razorpay. Don't show "failed" — send the student to the
    // status page, where "Check payment status" (or the webhook) completes it.
    reportFailure("payment", "Could not mark a PAID purchase as paid (student sees 'checking')", saved.error, { purchase: purchase.id.slice(0, 8) });
    return json({ ok: false, pending: true, redirect: `/payment-success?id=${purchase.id}` }, 202);
  }
  return json({ ok: true, redirect: `/payment-success?id=${saved.id ?? purchase.id}` });
}
