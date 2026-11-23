// GET /api/study-plan/<course id>/pdf — the student's printable study plan.
// Everything is read with the student's OWN login (Row Level Security): only a
// course they can open, only their own ticks and start date.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { loadStudentFiles } from "@/lib/student-files";
import { studyPlanPdf } from "@/lib/study-plan-pdf";
import { loadCoursePlans } from "@/lib/study-plan-server";

const noStore = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex" };
const text = (m: string, status: number) => new NextResponse(m, { status, headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: NextRequest, ctx: RouteContext<"/api/study-plan/[productId]/pdf">) {
  const { productId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return text("Not found", 404);
  const s = await getSession();
  if (!s) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/study-plan/${productId}/pdf`)}`, request.url));
  const [{ data: product }, { data: purchase }] = await Promise.all([
    s.supabase.from("products").select("title").eq("id", productId).maybeSingle(),
    s.supabase.from("purchases").select("created_at").eq("user_id", s.user.id).eq("product_id", productId).eq("status", "paid").order("created_at").limit(1).maybeSingle(),
  ]);
  const plans = await loadCoursePlans(s.supabase, s.user.id, [{ id: productId, enrolledAt: (purchase?.created_at as string) ?? new Date().toISOString() }]);
  const plan = plans?.get(productId);
  if (!plan) return text("This study plan isn't available.", 404);
  const files = await loadStudentFiles(s.supabase, [productId]);
  const bytes = await studyPlanPdf({
    course: (product?.title as string) ?? "Course",
    student: s.profile?.full_name || s.user.email?.split("@")[0] || "Student",
    start: plan.start,
    days: plan.days,
    done: new Set(plan.done),
    fileNames: Object.fromEntries(files.map((f) => [f.id, f.display_name])),
  });
  return new NextResponse(Buffer.from(bytes), { headers: { ...noStore, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="EDUVORA - Study plan.pdf"` } });
}
