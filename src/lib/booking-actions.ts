"use server";

// Student cancels their own upcoming booking (Dashboard → My Bookings).
// Runs with the student's OWN login, so Supabase still checks it's theirs and
// that only "cancel" is allowed (before_booking_update trigger). Then the
// Google Calendar event is cancelled too (Google tells the guest).
import { updateTag } from "next/cache";
import { getSession } from "./dashboard";
import { syncBookingCalendar } from "./google-calendar";

export async function cancelMyBooking(bookingId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Please log in again." };
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return { ok: false, error: "Booking not found." };
  const { data, error } = await s.supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("user_id", s.user.id)
    .in("status", ["pending", "confirmed"])
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "This booking can't be cancelled any more." };
  updateTag("slots"); // the slot is free again
  await syncBookingCalendar(bookingId);
  return { ok: true };
}
