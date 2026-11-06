// GET /api/files/<file id>            → download the file
// GET /api/files/<file id>?view=1     → open a PDF in the browser
// The server checks: logged in AND (paid for the product, or it's free, or admin).
// Only then it makes a 60-second link — students who haven't paid never get one.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { unlockFreeProduct } from "@/lib/free-resources";
import { getAdminSupabase } from "@/lib/supabase/admin";

const text = (msg: string, status: number) => new NextResponse(msg, { status, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const view = request.nextUrl.searchParams.get("view") === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return text("File not found.", 404);

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/dashboard/courses")}`, request.url));
  const db = getAdminSupabase();
  if (!db) return text("Downloads are not available right now.", 503);

  const { data: f } = await db
    .from("product_files")
    .select("id,display_name,file_path,file_type,product_id,products(is_free,is_active)")
    .eq("id", id)
    .maybeSingle();
  if (!f) return text("File not found.", 404);
  const product = f.products as unknown as { is_free: boolean; is_active: boolean } | null;

  const isAdmin = session.profile?.role === "admin";
  const freeItem = !!product?.is_active && !!product?.is_free;
  let allowed = isAdmin || freeItem;
  // Free item opened from a direct link → also add it to My Courses (and Admin → Students)
  if (freeItem && !isAdmin) await unlockFreeProduct(db, session.user.id, f.product_id as string);
  if (!allowed) {
    const { count } = await db
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .eq("product_id", f.product_id)
      .eq("status", "paid");
    allowed = (count ?? 0) > 0;
  }
  if (!allowed) return text("You need to buy this item before downloading it. If you already paid, please contact us.", 403);

  const fileName = `${f.display_name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "file"}.${f.file_type}`;
  const { data: signed, error } = await db.storage
    .from("materials")
    .createSignedUrl(f.file_path, 60, view && f.file_type === "pdf" ? undefined : { download: fileName });
  if (error || !signed) return text("This file is being prepared. Please try again in a little while or contact us.", 404);

  if (!isAdmin) await db.rpc("count_file_download", { p_file: f.id }); // download counter (admin sees it)
  const res = NextResponse.redirect(signed.signedUrl);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
