// The one handler behind "Open PDF" / "Download" (server only):
//   /api/files/<file id>/open      → shown in the browser (inline)
//   /api/files/<file id>/download  → saved as a file (attachment)
//   /api/files/<file id>?mode=…    → older links, same thing
// Whose copy is decided ONLY by the login cookie — nothing in the address
// (no user id, email or token) is ever trusted. Logged out → login, then back.
import "server-only";
import { after, NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { getSession } from "./dashboard";
import { cleanupCopies, deliverPdf, type PdfMode } from "./pdf-delivery";
import { getAdminSupabase } from "./supabase/admin";

const text = (msg: string, status: number) =>
  new NextResponse(msg, { status, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } });

export async function handleFileRequest(request: NextRequest, id: string, mode: PdfMode): Promise<NextResponse> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return text("File not found.", 404);
  const session = await getSession();
  if (!session) {
    const res = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/files/${id}/${mode}`)}`, request.url));
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }
  const db = getAdminSupabase();
  if (!db) return text("Files are not available right now.", 503);
  const isAdmin = session.profile?.role === "admin";
  if (siteConfig.inWebsiteReader && !isAdmin) return NextResponse.redirect(new URL(`/dashboard/read/${id}`, request.url));
  const res = await deliverPdf(request, db, session, id, mode);
  after(() => cleanupCopies(db).catch(() => 0)); // tidy copies older than 24 hours
  return res;
}
