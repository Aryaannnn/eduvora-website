// GET /api/guide/<request id> — the free guide (link from the popup and the email).
// The link works for 30 days. After a quick free login / sign-up the guide is
// unlocked into Dashboard → My Courses & Material, which opens with it — the only
// place to open or download PDFs (watermarked with the student's name).
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { unlockFreeProduct } from "@/lib/free-resources";
import { getAdminSupabase } from "@/lib/supabase/admin";

const DAYS = 30;

export async function GET(request: NextRequest, ctx: RouteContext<"/api/guide/[id]">) {
  const { id } = await ctx.params;
  const back = (why: string) => NextResponse.redirect(new URL(`/free-resources?guide=${why}`, request.url), 302);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return back("invalid");
  const db = getAdminSupabase();
  if (!db) return back("unavailable");
  const { data: r } = await db.from("guide_requests").select("id,product_id,created_at,downloads").eq("id", id).maybeSingle();
  if (!r?.product_id) return back("invalid");
  if (Date.now() - new Date(r.created_at as string).getTime() > DAYS * 86_400_000) return back("expired");
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/guide/${id}`)}`, request.url), 302);
  const productId = r.product_id as string;
  if (!(await unlockFreeProduct(db, session.user.id, productId))) return back("unavailable");
  await db.from("guide_requests").update({ downloads: Number(r.downloads ?? 0) + 1 }).eq("id", r.id);
  const res = NextResponse.redirect(new URL(`/dashboard/courses?unlocked=${productId}#item-${productId}`, request.url), 302);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
