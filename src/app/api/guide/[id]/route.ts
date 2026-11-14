// GET /api/guide/<request id> — downloads the free guide (link from the popup and the email).
// The link works for 30 days. Each time it creates a fresh 1-minute download link
// for the private PDF, so the file itself never has a long-lived public address.
import { NextResponse, type NextRequest } from "next/server";
import { guideFile } from "@/lib/growth";
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
  const file = await guideFile(r.product_id as string);
  if (!file) return back("unavailable");
  const { data: signed, error } = await db.storage.from("materials").createSignedUrl(file.path, 60, { download: file.name });
  if (error || !signed?.signedUrl) return back("unavailable");
  await db.from("guide_requests").update({ downloads: Number(r.downloads ?? 0) + 1 }).eq("id", r.id);
  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
