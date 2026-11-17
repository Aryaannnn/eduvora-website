// Old link from "Download Free" buttons: /api/download/<product id>
// → no file any more: a FREE item is unlocked for the logged-in student, then
//   Dashboard → My Courses & Material opens with that item (the only place to
//   open / download PDFs). Paid items → the same place (or the shop if not bought).
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { unlockFreeProduct } from "@/lib/free-resources";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/download/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(new URL("/dashboard/courses", request.url));
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/download/${id}`)}`, request.url));
  const db = getAdminSupabase();
  const { data: p } = db ? await db.from("products").select("id,is_free,is_active").eq("id", id).maybeSingle() : { data: null };
  if (db && p?.is_free && p.is_active) {
    await unlockFreeProduct(db, session.user.id, p.id as string);
    return NextResponse.redirect(new URL(`/dashboard/courses?unlocked=${id}#item-${id}`, request.url));
  }
  return NextResponse.redirect(new URL(`/dashboard/courses?open=${id}#item-${id}`, request.url));
}
