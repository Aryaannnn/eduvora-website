// Old link from "Download Free" buttons: /api/download/<product id>
// → the product's FIRST PDF: "Open PDF" (personal watermarked copy) — or the in-website reader if switched on.
import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { getSession } from "@/lib/dashboard";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/download/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/download/${id}`)}`, request.url));
  const db = getAdminSupabase();
  if (!db || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("File not found.", { status: 404 });

  const { data } = await db.from("product_files").select("id").eq("product_id", id).eq("file_type", "pdf").order("sort_order").order("created_at").limit(1);
  if (!data?.[0]) return new NextResponse("No file has been added to this item yet. Please contact us.", { status: 404 });
  return NextResponse.redirect(new URL(siteConfig.inWebsiteReader ? `/dashboard/read/${data[0].id}` : `/api/files/${data[0].id}?mode=open`, request.url));
}
