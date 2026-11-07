// POST /api/payments/webhook — Razorpay calls this directly (server to server),
// so payments are saved even if the student closes the browser.
// Set it up in Razorpay Dashboard → Account & Settings → Webhooks:
//   URL:     https://YOUR-DOMAIN/api/payments/webhook
//   Secret:  any long random text → put the same text in RAZORPAY_WEBHOOK_SECRET
//   Events:  payment.captured, payment.failed
import { NextResponse, type NextRequest } from "next/server";
import { markBookingPaid } from "@/lib/bookings-server";
import { markPurchasePaid } from "@/lib/payments-server";
import { isWebhookConfigured, verifyWebhookSignature } from "@/lib/razorpay";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { reportFailure } from "@/lib/monitor";

type PaymentEntity = { id: string; order_id: string | null; amount: number; status: string; error_description?: string | null };

export async function POST(request: NextRequest) {
  if (!isWebhookConfigured()) return NextResponse.json({ error: "Webhook secret not set" }, { status: 503 });

  const raw = await request.text(); // the exact raw body is needed for the signature check
  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"))) {
    reportFailure("payment", "Webhook signature check failed (check RAZORPAY_WEBHOOK_SECRET)");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  let event: { event?: string; payload?: { payment?: { entity?: PaymentEntity } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id) return NextResponse.json({ ok: true, ignored: true });

  const { data: purchase } = await admin.from("purchases").select("id,amount,status").eq("razorpay_order_id", payment.order_id).maybeSingle();
  if (!purchase) {
    // Not a product purchase — maybe a counselling booking payment
    const { data: booking } = await admin.from("bookings").select("id,amount,payment_status").eq("razorpay_order_id", payment.order_id).maybeSingle();
    if (!booking) return NextResponse.json({ ok: true, ignored: "unknown order" });
    if (event.event === "payment.captured") {
      if (payment.amount !== Number(booking.amount) * 100) {
        reportFailure("payment", "Webhook: booking amount mismatch", undefined, { booking: booking.id.slice(0, 8) });
        return NextResponse.json({ ok: true, ignored: "amount mismatch" });
      }
      const { error } = await markBookingPaid(admin, payment.order_id, payment.id);
      if (error) {
        reportFailure("booking", "Webhook: could not mark a PAID booking as paid", error, { booking: booking.id.slice(0, 8) });
        return NextResponse.json({ error: "Could not save" }, { status: 500 });
      }
    } else if (event.event === "payment.failed" && booking.payment_status === "pending") {
      // Failed → release the held slot (hidden 'expired'); a later success still confirms it
      await admin
        .from("bookings")
        .update({ status: "expired", payment_status: "failed", hold_expires_at: null })
        .eq("id", booking.id)
        .eq("status", "awaiting_payment");
    }
    return NextResponse.json({ ok: true });
  }

  if (event.event === "payment.captured") {
    if (payment.amount !== purchase.amount * 100) {
      reportFailure("payment", "Webhook: purchase amount mismatch", undefined, { purchase: purchase.id.slice(0, 8) });
      return NextResponse.json({ ok: true, ignored: "amount mismatch" });
    }
    const { error } = await markPurchasePaid(admin, payment.order_id, payment.id);
    if (error) {
      reportFailure("payment", "Webhook: could not mark a PAID purchase as paid", error, { purchase: purchase.id.slice(0, 8) });
      return NextResponse.json({ error: "Could not save" }, { status: 500 }); // Razorpay retries later
    }
  } else if (event.event === "payment.failed" && purchase.status !== "paid") {
    // Razorpay itself reports the failure → now it shows in the lists as 'failed'
    await admin
      .from("purchases")
      .update({ status: "failed", failure_reason: (payment.error_description ?? "Payment failed").slice(0, 300) })
      .eq("id", purchase.id)
      .in("status", ["created", "pending", "abandoned"]);
  }
  return NextResponse.json({ ok: true });
}
