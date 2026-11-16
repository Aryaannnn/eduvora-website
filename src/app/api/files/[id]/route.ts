// GET /api/files/<file id>
// Course material is READ ONLINE ONLY (no downloads):
//   • students → the secure reader (/dashboard/read/<id>): one watermarked page
//     at a time, access checked on every page, every page logged
//   • admins   → the original file (to check what was uploaded)
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { getAdminSupabase } from "@/lib/supabase/admin";

const text = (msg: string, status: number) => new NextResponse(msg, { status, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return text("File not found.", 404);
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/dashboard/read/${id}`)}`, request.url));

  // ---------- students: read online ----------
  if (session.profile?.role !== "admin") return NextResponse.redirect(new URL(`/dashboard/read/${id}`, request.url));

  // ---------- admins: the original ----------
  const db = getAdminSupabase();
  if (!db) return text("Files are not available right now.", 503);
  const { data: f } = await db.from("product_files").select("display_name,file_path,file_type").eq("id", id).maybeSingle();
  if (!f) return text("File not found.", 404);
  const fileName = `${String(f.display_name).replace(/[\/:*?"<>|]+/g, " ").trim() || "file"}.${f.file_type}`;
  const inline = request.nextUrl.searchParams.get("view") === "1" && f.file_type === "pdf";
  const { data: signed, error } = await db.storage.from("materials").createSignedUrl(f.file_path as string, 60, inline ? undefined : { download: fileName });
  if (error || !signed) return text("This file is being prepared. Please try again in a little while.", 404);
  const res = NextResponse.redirect(signed.signedUrl);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
