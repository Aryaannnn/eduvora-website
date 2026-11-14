import type { Metadata } from "next";
import { Suspense } from "react";
import type { BookingNote } from "@/components/admin/BookingNotes";
import BookingsManager, { type AdminBooking, type FreeSlot } from "@/components/admin/BookingsManager";
import StaffBookings, { type StaffBooking } from "@/components/admin/StaffBookings";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireStaff } from "@/lib/admin";
import type { Session } from "@/lib/dashboard";
import { todayInIndia } from "@/lib/format";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

/** Staff names + booking notes (empty before supabase/counsellor.sql). */
async function staffExtras(s: Session) {
  const [staff, notesRes] = await Promise.all([
    s.supabase.from("staff_members").select("id,full_name,email,role").order("full_name"),
    s.supabase.from("booking_notes").select("id,booking_id,body,created_at,created_by").order("created_at", { ascending: false }).limit(5000),
  ]);
  const members = (staff.data ?? []) as { id: string; full_name: string | null; email: string | null; role: string }[];
  const staffNames = Object.fromEntries(members.map((m) => [m.id, m.full_name || m.email || "Staff"]));
  const notes: Record<string, BookingNote[]> = {};
  for (const n of (notesRes.data ?? []) as (BookingNote & { booking_id: string })[]) (notes[n.booking_id] ??= []).push(n);
  return { members, staffNames, notes, ready: !staff.error && !notesRes.error };
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/bookings">["searchParams"] }) {
  const { s, role } = await requireStaff("/admin/bookings");
  const sp = await searchParams;

  // ---------- COUNSELLOR: safe view without amounts / payment details ----------
  if (role === "counsellor") {
    const [{ data, error }, extras] = await Promise.all([
      s.supabase
        .from("staff_bookings")
        .select("id,name,phone,email,class_year,expected_marks,message,status,created_at,meet_link,assigned_to,slot_date,slot_start,slot_end")
        .order("created_at", { ascending: false })
        .limit(1000),
      staffExtras(s),
    ]);
    if (error) return <p className="card p-6 text-red-600">Bookings are not set up for counsellors yet (admin: run supabase/roles.sql once).</p>;
    return <StaffBookings bookings={(data ?? []) as StaffBooking[]} notes={extras.notes} today={todayInIndia()} me={s.user.id} staffNames={extras.staffNames} notAllowed={sp.notAllowed === "1"} />;
  }

  // ---------- ADMIN ----------
  const cols = "id,name,phone,email,message,class_year,expected_marks,status,payment_status,amount,invoice_number,paid_at,created_at,slots(date,start_time,end_time,price)";
  const load = (c: string) =>
    s.supabase
      .from("bookings")
      .select(c)
      .not("status", "in", "(awaiting_payment,expired)") // unpaid attempts are never shown
      .order("created_at", { ascending: false })
      .limit(500);
  let { data, error } = await load(`${cols},meet_link,calendar_status,calendar_error,assigned_to`);
  if (error?.code === "42703") ({ data, error } = await load(`${cols},meet_link,calendar_status,calendar_error`)); // counsellor.sql not run yet
  const meetReady = error?.code !== "42703"; // google-calendar.sql run?
  if (!meetReady) ({ data, error } = await load(cols));
  if (error) return <p className="card p-6 text-red-600">Could not load bookings: {error.message}</p>;
  const [{ data: freeSlots }, extras] = await Promise.all([
    s.supabase
      .from("slots")
      .select("id,date,start_time,end_time")
      .eq("is_available", true)
      .gte("date", todayInIndia())
      .order("date")
      .order("start_time")
      .limit(200),
    staffExtras(s),
  ]);
  return (
    <BookingsManager
      bookings={(data ?? []) as unknown as AdminBooking[]}
      today={todayInIndia()}
      freeSlots={(freeSlots ?? []) as FreeSlot[]}
      meetReady={meetReady}
      staff={extras.ready ? extras.members : null}
      staffNames={extras.staffNames}
      notes={extras.notes}
      me={s.user.id}
    />
  );
}
