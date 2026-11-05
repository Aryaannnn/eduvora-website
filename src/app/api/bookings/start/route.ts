// POST /api/bookings/start — the "Pay ₹… & Book Slot" button.
// Quietly holds the slot for 10 minutes and creates the Razorpay order.
// The PRICE comes from the slot in our database, never from the browser.
import { after, NextResponse, type NextRequest } from "next/server";
import { releaseStaleHolds, parseBookingInput, SLOT_TAKEN_MESSAGE, startBooking, HOLD_MINUTES } from "@/lib/bookings-server";
import { getSession } from "@/lib/dashboard";
import { welcomeIfNew } from "@/lib/email/notify";
import { getAdminSupabase } from "@/lib/supabase/admin";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseBookingInput(body);
  if (typeof input === "string") return json({ error: input }, 400);

  const session = await getSession();
  if (!session) return json({ error: "Please log in to book.", login: true }, 401);
  welcomeIfNew(session.user.id);
  const db = getAdminSupabase();
  if (!db) return json({ error: "Booking is not available right now." }, 503);

  const res = await startBooking(db, session.user.id, input);
  after(() => releaseStaleHolds(db).catch(() => {})); // tidy old holds in the background

  if (res.kind === "slot_taken") return json({ error: SLOT_TAKEN_MESSAGE, slotTaken: true }, 409);
  if (res.kind === "error") return json({ error: res.message }, res.status);
  if (res.kind === "free") return json({ redirect: `/booking-confirmed?id=${res.bookingId}` });

  return json({
    bookingId: res.bookingId,
    orderId: res.orderId,
    amount: res.amountPaise,
    currency: res.currency,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    title: "One-to-one counselling session",
    prefill: { name: input.name, email: input.email || session.user.email || "", contact: input.phone.replace(/[^\d+]/g, "") },
    holdSeconds: HOLD_MINUTES * 60,
  });
}
