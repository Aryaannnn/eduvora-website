// =====================================================================
//  COUNSELLING BOOKINGS — SERVER ONLY (service role key)
//  Pay first, then booked:
//   1. startBooking(): quietly HOLD the slot for 10 min (hidden status
//      'awaiting_payment') and create a Razorpay order.
//   2. Payment verified → mark_booking_paid() → 'confirmed' + invoice.
//   3. Popup closed / failed / too late → releaseHold() → 'expired' (hidden),
//      slot free again. We always ask Razorpay first, so a real payment is
//      never released.
// =====================================================================
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyBookingConfirmed } from "./email/notify";
import { discountColumns, quote, recordCouponUse } from "./pricing";
import { createRazorpayOrder, getOrderOutcome, isRazorpayConfigured } from "./razorpay";
import { reportFailure } from "./monitor";

export const HOLD_MINUTES = 10;

/** Payment verified → booking confirmed (+ invoice number) → confirmation emails (sent once). */
export async function markBookingPaid(db: SupabaseClient, orderId: string, paymentId: string | null): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await db.rpc("mark_booking_paid", { p_order_id: orderId, p_payment_id: paymentId });
  if (error) {
    reportFailure("booking", "mark_booking_paid() failed", error.message);
    return { id: null, error: error.message };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; payment_status: string } | undefined;
  if (row?.id && row.payment_status === "paid") notifyBookingConfirmed(row.id);
  return { id: row?.id ?? null, error: null };
}
export const SLOT_TAKEN_MESSAGE = "Sorry, this slot was just booked. Please choose another time.";
export const NOT_COMPLETED_MESSAGE = "Payment not completed. Your slot was not booked. Please try again.";

export type BookingInput = {
  slotId: string; name: string; phone: string; email: string; classYear: string; expectedMarks: number | null; message: string;
};

const CLASS_YEARS = ["Class 11", "Class 12", "Dropper / Repeater", "Parent", "Other"];

export function parseBookingInput(b: Record<string, unknown>): BookingInput | string {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const slotId = str(b.slotId, 40);
  if (!/^[0-9a-f-]{36}$/i.test(slotId)) return "Please choose a time slot.";
  const name = str(b.name, 80);
  if (name.length < 2) return "Please enter the student's name.";
  const phone = str(b.phone, 16);
  if (!/^[0-9+ ()-]{10,16}$/.test(phone) || phone.replace(/\D/g, "").length < 10) return "Please enter a valid 10-digit phone number.";
  const email = str(b.email, 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Please enter a valid email (or leave it empty).";
  const classYear = str(b.classYear, 40);
  if (classYear && !CLASS_YEARS.includes(classYear)) return "Please choose your class / year.";
  const marksRaw = b.expectedMarks;
  const marks = marksRaw === "" || marksRaw === null || marksRaw === undefined ? null : Number(marksRaw);
  if (marks !== null && !(Number.isFinite(marks) && marks >= 0 && marks <= 125)) return "Expected marks must be between 0 and 125.";
  return { slotId, name, phone, email, classYear, expectedMarks: marks, message: str(b.message, 1000) };
}

type Held = { id: string; status: string; amount: number; slot_id: string };

export type StartResult =
  | { kind: "free"; bookingId: string }
  | { kind: "order"; bookingId: string; orderId: string; amountPaise: number; currency: string }
  | { kind: "slot_taken" }
  | { kind: "error"; message: string; status: number };

export async function startBooking(db: SupabaseClient, userId: string, input: BookingInput, coupon?: unknown): Promise<StartResult> {
  const { data, error } = await db.rpc("hold_slot", {
    p_user: userId,
    p_slot: input.slotId,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    p_class_year: input.classYear,
    p_expected_marks: input.expectedMarks,
    p_message: input.message,
  });
  if (error) {
    if (/no longer available/i.test(error.message)) return { kind: "slot_taken" };
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      return { kind: "error", status: 503, message: "Booking is being set up. (Admin: run supabase/booking-payment-first.sql in Supabase.)" };
    }
    reportFailure("booking", "Could not hold the slot", error.message);
    return { kind: "error", status: 500, message: "Could not start the booking. Please try again." };
  }
  const held = (Array.isArray(data) ? data[0] : data) as Held;
  if (held.status === "confirmed") {
    notifyBookingConfirmed(held.id); // free slot → booked at once
    return { kind: "free", bookingId: held.id };
  }

  if (!isRazorpayConfigured()) {
    await releaseHold(db, held.id, "error");
    return { kind: "error", status: 503, message: "Online payment is not available right now. Please try again later." };
  }
  // The real price: coupon + referral discount + reward credit (src/lib/pricing.ts)
  const q = await quote(db, userId, { kind: "slot", id: input.slotId, price: held.amount }, coupon);
  if (q.couponError) {
    await releaseHold(db, held.id, "error");
    return { kind: "error", status: 400, message: q.couponError };
  }
  if (q.final !== held.amount) {
    const { error: e1 } = await db.from("bookings").update({ amount: q.final, ...discountColumns(q) }).eq("id", held.id);
    if (e1) {
      reportFailure("booking", "Discount could not be saved on the booking", e1.message);
      await releaseHold(db, held.id, "error");
      return { kind: "error", status: 500, message: "Could not apply the discount. Please try again." };
    }
    await recordCouponUse(db, userId, q, { bookingId: held.id });
  }

  try {
    const order = await createRazorpayOrder(q.final, `b_${held.id.slice(0, 8)}_${Date.now()}`, { booking_id: held.id, user_id: userId, type: "counselling" });
    const { error: e2 } = await db.from("bookings").update({ razorpay_order_id: order.id }).eq("id", held.id);
    if (e2) throw new Error(e2.message);
    return { kind: "order", bookingId: held.id, orderId: order.id, amountPaise: order.amount, currency: order.currency };
  } catch (e) {
    reportFailure("booking", "Razorpay order for a booking could not be created", e);
    await releaseHold(db, held.id, "error");
    return { kind: "error", status: 502, message: "Could not start the payment. Please try again in a minute." };
  }
}

/** Free a held slot — but first ask Razorpay, so a real payment is never released. */
export async function releaseHold(db: SupabaseClient, bookingId: string, reason: "dismissed" | "failed" | "error" | "timeout"): Promise<{ status: "paid" | "released" | "unchanged" }> {
  const { data: b } = await db.from("bookings").select("id,status,payment_status,razorpay_order_id,amount").eq("id", bookingId).maybeSingle();
  if (!b) return { status: "unchanged" };
  if (b.payment_status === "paid") return { status: "paid" };
  if (b.status !== "awaiting_payment") return { status: "unchanged" };

  let failed = reason === "failed";
  if (b.razorpay_order_id) {
    const out = await getOrderOutcome(b.razorpay_order_id);
    if (out.kind === "paid" && out.amount === Number(b.amount) * 100) {
      const { error } = await markBookingPaid(db, b.razorpay_order_id, out.paymentId);
      if (!error) return { status: "paid" };
    }
    if (out.kind === "failed") failed = true;
  }
  await db
    .from("bookings")
    .update({ status: "expired", payment_status: failed ? "failed" : "unpaid", hold_expires_at: null })
    .eq("id", b.id)
    .eq("status", "awaiting_payment");
  return { status: "released" };
}

/** "Check payment status" for a booking (greeting page fallback). */
export async function checkBookingPayment(db: SupabaseClient, bookingId: string): Promise<"paid" | "not_paid" | "unknown"> {
  const { data: b } = await db.from("bookings").select("id,payment_status,razorpay_order_id,amount").eq("id", bookingId).maybeSingle();
  if (!b) return "unknown";
  if (b.payment_status === "paid") return "paid";
  if (!b.razorpay_order_id) return "not_paid";
  const out = await getOrderOutcome(b.razorpay_order_id);
  if (out.kind === "paid" && out.amount === Number(b.amount) * 100) {
    const { error } = await markBookingPaid(db, b.razorpay_order_id, out.paymentId);
    return error ? "unknown" : "paid";
  }
  return out.kind === "error" ? "unknown" : "not_paid";
}

/** Holds past their 10 minutes: check Razorpay, then confirm or release. */
export async function releaseStaleHolds(db: SupabaseClient, limit = 25) {
  const { data } = await db
    .from("bookings")
    .select("id")
    .eq("status", "awaiting_payment")
    .lt("hold_expires_at", new Date().toISOString())
    .limit(limit);
  let paid = 0, released = 0;
  for (const b of data ?? []) {
    const r = await releaseHold(db, b.id, "timeout");
    if (r.status === "paid") paid++;
    else if (r.status === "released") released++;
  }
  return { paid, released };
}

/** Booking statuses that are hidden from every list (unpaid attempts). */
/**
 * Book a slot using ONE session credit (from a counselling package).
 * Confirmed at once, no payment. The credit check runs inside Supabase
 * (book_with_credit in supabase/packages.sql), so it can't be faked.
 */
export async function bookWithCredit(db: SupabaseClient, userId: string, input: BookingInput): Promise<StartResult> {
  const { data, error } = await db.rpc("book_with_credit", {
    p_user: userId,
    p_slot: input.slotId,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    p_class_year: input.classYear,
    p_expected_marks: input.expectedMarks,
    p_message: input.message,
  });
  if (error) {
    if (/no longer available/i.test(error.message)) return { kind: "slot_taken" };
    if (/no session credits/i.test(error.message)) return { kind: "error", status: 402, message: "You have no session credits left. Please pay for this slot or buy a package." };
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      return { kind: "error", status: 503, message: "Packages are being set up. (Admin: run supabase/packages.sql in Supabase.)" };
    }
    reportFailure("booking", "Booking with a package credit failed", error.message);
    return { kind: "error", status: 500, message: "Could not book the slot. Please try again." };
  }
  const b = (Array.isArray(data) ? data[0] : data) as { id: string };
  notifyBookingConfirmed(b.id); // confirmation emails (sent once)
  return { kind: "free", bookingId: b.id };
}

export const HIDDEN_BOOKING_STATUSES = ["awaiting_payment", "expired"];
