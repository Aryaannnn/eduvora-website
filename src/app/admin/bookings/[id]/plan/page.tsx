import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CollegePlanForm from "@/components/admin/CollegePlanForm";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireStaff } from "@/lib/admin";
import { PLAN_COLUMNS, type CollegePlan } from "@/lib/college-plan";
import { formatDate, formatTime } from "@/lib/format";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "College plan" };

// (the page needs one example address to build; real booking ids work on demand)
export async function generateStaticParams() {
  return [{ id: "start" }];
}

// Admin → Bookings → "Write college plan" (admins and counsellors)
export default function CollegePlanPage(props: PageProps<"/admin/bookings/[id]/plan">) {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/admin/bookings/[id]/plan">["params"] }) {
  const { id } = await params;
  const { s } = await requireStaff(`/admin/bookings/${id}/plan`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getAdminSupabase();
  const { data: b } = db ? await db.from("bookings").select("id,name,status,user_id,slots(date,start_time)").eq("id", id).maybeSingle() : { data: null };
  if (!b) notFound();
  const slot = b.slots as unknown as { date: string; start_time: string } | null;
  // the plan through the staff member's own login (Row Level Security)
  const { data: plan, error } = await s.supabase.from("college_plans").select(PLAN_COLUMNS).eq("booking_id", id).maybeSingle();

  return (
    <>
      <Link href="/admin/bookings" className="text-sm font-semibold text-brand-700 hover:underline">← Back to bookings</Link>
      <div className="mt-3 mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">College plan — {b.name as string}</h1>
        <p className="text-sm text-slate-600">
          Call {slot ? `on ${formatDate(slot.date, true)} at ${formatTime(slot.start_time)} IST` : "(slot removed)"} · booking status: {b.status as string}
          {!b.user_id && " · ⚠️ this booking has no student account, so nobody can see a published plan"}
        </p>
      </div>
      {error ? (
        <p className="card p-6 text-red-600">{/college_plans/.test(error.message) ? "Run supabase/college-plans.sql in Supabase first." : error.message}</p>
      ) : (
        <CollegePlanForm bookingId={id} plan={(plan as CollegePlan | null) ?? null} />
      )}
    </>
  );
}
