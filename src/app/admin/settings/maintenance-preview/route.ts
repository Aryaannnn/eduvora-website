// GET /admin/settings/maintenance-preview — admins see exactly what visitors
// will see while maintenance mode is ON (with the saved message).
import { NextResponse } from "next/server";
import { hasAdmin2fa } from "@/lib/admin";
import { getSession } from "@/lib/dashboard";
import { maintenanceHtml } from "@/lib/maintenance";

export async function GET(request: Request) {
  const s = await getSession();
  if (!s || s.profile?.role !== "admin" || !(await hasAdmin2fa(s))) return NextResponse.redirect(new URL("/login?next=/admin/settings", request.url));
  const { data } = await s.supabase.from("maintenance_settings").select("message").eq("id", 1).maybeSingle();
  return new NextResponse(maintenanceHtml(data?.message ?? ""), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
