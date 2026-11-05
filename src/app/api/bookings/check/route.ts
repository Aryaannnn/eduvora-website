// POST /api/bookings/check   body: { bookingId }
// "Check payment status" on the booking page — asks Razorpay and confirms
// the booking if the money arrived.
import { NextResponse, type NextRequest } from "next/server";
import { checkBookingPayment } from "@/lib/bookings-server";
import { getSession } from "@/lib/dashboard";
import { getAdminSupabase } from "@/lib/supabase/admin";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as { bookingId?: unknown };
  if (typeof b.bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(b.bookingId)) return json({ error: "Invalid booking." }, 400);
  const session = await getSession();
  if (!session) return json({ error: "Please log in." }, 401);
  const db = getAdminSupabase();
  if (!db) return json({ error: "Not configured" }, 503);
  const { data: owner } = await db.from("bookings").select("user_id").eq("id", b.bookingId).maybeSingle();
  const isAdmin = session.profile?.role === "admin";
  if (!owner || (owner.user_id !== session.user.id && !isAdmin)) return json({ error: "Not found." }, 404);

  const status = await checkBookingPayment(db, b.bookingId);
  return json({
    status,
    message: status === "paid" ? "Payment found — your session is booked!" : status === "not_paid" ? "Razorpay has no completed payment for this booking." : "Could not reach Razorpay. Please try again in a minute.",
  });
}
