// POST /api/bookings/release   body: { bookingId, reason: "dismissed" | "failed" }
// Popup closed or payment failed → free the held slot at once.
// (We ask Razorpay first: if it was actually paid, the booking is confirmed instead.)
import { NextResponse, type NextRequest } from "next/server";
import { releaseHold } from "@/lib/bookings-server";
import { getSession } from "@/lib/dashboard";
import { getAdminSupabase } from "@/lib/supabase/admin";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as { bookingId?: unknown; reason?: unknown };
  if (typeof b.bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(b.bookingId)) return json({ error: "Invalid booking." }, 400);
  const session = await getSession();
  if (!session) return json({ error: "Please log in." }, 401);
  const db = getAdminSupabase();
  if (!db) return json({ error: "Not configured" }, 503);

  const { data: owner } = await db.from("bookings").select("user_id").eq("id", b.bookingId).maybeSingle();
  if (!owner || owner.user_id !== session.user.id) return json({ error: "Not found." }, 404);

  const res = await releaseHold(db, b.bookingId, b.reason === "failed" ? "failed" : "dismissed");
  if (res.status === "paid") return json({ status: "paid", redirect: `/booking-confirmed?id=${b.bookingId}` });
  return json({ status: res.status });
}
