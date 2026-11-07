// POST /api/payments/booking-verify — after Razorpay says the counselling
// payment worked. We check the signature with our SECRET; only then the
// booking becomes paid + confirmed, which also unlocks the predictor at once.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { markBookingPaid } from "@/lib/bookings-server";
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

  const { data: booking } = await admin.from("bookings").select("id,user_id").eq("razorpay_order_id", orderId).maybeSingle();
  if (!booking || booking.user_id !== session.user.id) return json({ error: "Booking not found." }, 404);

  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    // Not trusted. The hold stays until Razorpay itself tells us what happened.
    reportFailure("payment", "Booking payment signature check failed", undefined, { booking: booking.id.slice(0, 8) });
    return json({ error: "We could not verify this payment.", bookingId: booking.id }, 400);
  }

  const { error } = await markBookingPaid(admin, orderId, paymentId);
  if (error) {
    // The money IS with Razorpay → greeting page shows "Checking your payment" + a check button
    reportFailure("booking", "Could not mark a PAID booking as paid (student sees 'checking')", error, { booking: booking.id.slice(0, 8) });
    return json({ ok: false, redirect: `/booking-confirmed?id=${booking.id}` }, 202);
  }
  return json({ ok: true, redirect: `/booking-confirmed?id=${booking.id}` });
}
