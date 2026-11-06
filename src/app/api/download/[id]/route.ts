// Old link kept for "Download Free" buttons: /api/download/<product id>
// → sends you to the product's FIRST file (/api/files/<file id>), which does
//   all the checks (logged in + paid or free) and makes a 60-second link.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/download/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/download/${id}`)}`, request.url));
  const db = getAdminSupabase();
  if (!db || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("File not found.", { status: 404 });

  const { data } = await db.from("product_files").select("id").eq("product_id", id).order("sort_order").order("created_at").limit(1);
  if (!data?.[0]) return new NextResponse("No file has been added to this item yet. Please contact us.", { status: 404 });
  return NextResponse.redirect(new URL(`/api/files/${data[0].id}`, request.url));
}
