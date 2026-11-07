import type { Metadata } from "next";
import { Suspense } from "react";
import BookingsManager, { type AdminBooking, type FreeSlot } from "@/components/admin/BookingsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";
import { todayInIndia } from "@/lib/format";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/bookings");
  const cols = "id,name,phone,email,message,class_year,expected_marks,status,payment_status,amount,invoice_number,paid_at,created_at,slots(date,start_time,end_time,price)";
  const load = (c: string) =>
    s.supabase
      .from("bookings")
      .select(c)
      .not("status", "in", "(awaiting_payment,expired)") // unpaid attempts are never shown
      .order("created_at", { ascending: false })
      .limit(500);
  let { data, error } = await load(`${cols},meet_link,calendar_status,calendar_error`);
  const meetReady = error?.code !== "42703"; // google-calendar.sql run?
  if (!meetReady) ({ data, error } = await load(cols));
  if (error) return <p className="card p-6 text-red-600">Could not load bookings: {error.message}</p>;
  const { data: freeSlots } = await s.supabase
    .from("slots")
    .select("id,date,start_time,end_time")
    .eq("is_available", true)
    .gte("date", todayInIndia())
    .order("date")
    .order("start_time")
    .limit(200);
  return <BookingsManager bookings={(data ?? []) as unknown as AdminBooking[]} today={todayInIndia()} freeSlots={(freeSlots ?? []) as FreeSlot[]} meetReady={meetReady} />;
}
