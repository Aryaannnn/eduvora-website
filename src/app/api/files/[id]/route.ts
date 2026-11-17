// GET /api/files/<file id>?mode=open      → "Open PDF" (new tab, browser's viewer)
// GET /api/files/<file id>?mode=download  → "Download"
// Students get their PERSONAL WATERMARKED copy (src/lib/pdf-delivery.ts): login
// + access checked on every request, daily limit, 7-day cache, every request
// logged, and a 5-minute link to the copy. Never the original.
// Admins (and the admin "Preview") get a watermarked copy too — the original
// file and its storage address never reach any browser.
// (With siteConfig.inWebsiteReader = true, students go to the in-website reader instead.)
import { after, NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { getSession } from "@/lib/dashboard";
import { cleanupCopies, deliverPdf, type PdfMode } from "@/lib/pdf-delivery";
import { getAdminSupabase } from "@/lib/supabase/admin";

// Run next to the database (Supabase: Singapore, ap-southeast-1) → fewer slow round trips
export const preferredRegion = "sin1";
export const maxDuration = 60;

const text = (msg: string, status: number) => new NextResponse(msg, { status, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return text("File not found.", 404);
  const mode: PdfMode = request.nextUrl.searchParams.get("mode") === "download" ? "download" : "open";
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/files/${id}?mode=${mode}`)}`, request.url));
  const db = getAdminSupabase();
  if (!db) return text("Files are not available right now.", 503);
  const isAdmin = session.profile?.role === "admin";

  // ---------- everyone (students and admins): a personal watermarked copy ----------
  if (siteConfig.inWebsiteReader && !isAdmin) return NextResponse.redirect(new URL(`/dashboard/read/${id}`, request.url));
  const res = await deliverPdf(request, db, session, id, mode);
  after(() => cleanupCopies(db).catch(() => 0)); // tidy copies older than 7 days
  return res;
}
