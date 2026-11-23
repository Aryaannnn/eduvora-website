import Link from "next/link";

/** "Write college plan" (or "Edit plan" + "Plan ready" / "Draft" badge) on a booking — admins and counsellors */
export default function PlanButton({ bookingId, status }: { bookingId: string; status?: "draft" | "published" }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {status === "published" && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">✓ Plan ready</span>}
      {status === "draft" && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Plan draft</span>}
      <Link href={`/admin/bookings/${bookingId}/plan`} className="btn-light !px-3 !py-2 text-sm">
        📋 {status ? "Edit college plan" : "Write college plan"}
      </Link>
    </span>
  );
}
