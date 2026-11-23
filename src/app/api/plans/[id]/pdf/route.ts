// GET /api/plans/<plan id>/pdf — "Download PDF" of a college plan.
// Read through the visitor's OWN login, so Row Level Security decides:
// the student who booked (published plans only), admins and counsellors.
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isStaffRole } from "@/lib/phone";
import { NextResponse, type NextRequest } from "next/server";
import { PLAN_COLUMNS, type CollegePlan } from "@/lib/college-plan";
import { collegePlanPdf } from "@/lib/college-plan-pdf";
import { getSession } from "@/lib/dashboard";
import { formatDate, formatTime } from "@/lib/format";

const noStore = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex" };

export async function GET(request: NextRequest, ctx: RouteContext<"/api/plans/[id]/pdf">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404, headers: noStore });
  const s = await getSession();
  if (!s) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/plans/${id}/pdf`)}`, request.url));
  const { data: plan } = await s.supabase.from("college_plans").select(PLAN_COLUMNS).eq("id", id).maybeSingle();
  if (!plan) return new NextResponse("This plan isn't available.", { status: 404, headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" } });
  let { data: b } = await s.supabase.from("bookings").select("name,slots(date,start_time)").eq("id", (plan as CollegePlan).booking_id).maybeSingle();
  if (!b && isStaffRole(s.profile?.role)) {
    const db = getAdminSupabase(); // (the plan itself was already allowed by the database above)
    ({ data: b } = db ? await db.from("bookings").select("name,slots(date,start_time)").eq("id", (plan as CollegePlan).booking_id).maybeSingle() : { data: null });
  }
  const slot = b?.slots as unknown as { date: string; start_time: string } | null;
  const bytes = await collegePlanPdf(plan as CollegePlan, {
    studentName: (b?.name as string) || s.profile?.full_name || "Student",
    callDate: slot ? `${formatDate(slot.date, true)}, ${formatTime(slot.start_time)} IST` : "-",
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: { ...noStore, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="EDUVORA - College plan.pdf"` },
  });
}
