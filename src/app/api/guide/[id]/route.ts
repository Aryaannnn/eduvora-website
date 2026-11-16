// GET /api/guide/<request id> — opens the free guide (link from the popup and the email).
// The link works for 30 days. Material is READ ONLINE ONLY: the guide opens in the
// secure reader (/dashboard/read/<file>) after a quick free login / sign-up.
import { NextResponse, type NextRequest } from "next/server";
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
  const { data: f } = await db.from("product_files").select("id").eq("product_id", r.product_id).eq("file_type", "pdf").order("sort_order").order("created_at").limit(1).maybeSingle();
  if (!f) return back("unavailable");
  await db.from("guide_requests").update({ downloads: Number(r.downloads ?? 0) + 1 }).eq("id", r.id);
  const res = NextResponse.redirect(new URL(`/dashboard/read/${f.id}`, request.url), 302); // login first if needed (proxy)
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
