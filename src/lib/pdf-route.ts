// The one handler behind "Open PDF" / "Download" (server only):
//   /api/files/<file id>/open      → shown in the browser (inline)
//   /api/files/<file id>/download  → saved as a file (attachment)
//   /api/files/<file id>?mode=…    → older links, same thing
//   POST /api/files/<file id>/prepare → the Download button first gets the copy ready
//                                        (JSON), shows "Preparing…" and a friendly error
// Whose copy is decided ONLY by the login cookie — nothing in the address
// (no user id, email or token) is ever trusted. Logged out → login, then back.
import "server-only";
import { after, NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { getSession } from "./dashboard";
import { cleanupCopies, deliverPdf, preparePdf, type PdfMode } from "./pdf-delivery";
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

/** POST /api/files/<id>/prepare?mode=download → JSON { ok, href } or { ok: false, message, retry } */
export async function handlePrepareRequest(request: NextRequest, id: string): Promise<NextResponse> {
  const json = (body: object, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, message: "File not found.", retry: false }, 404);
  const mode: PdfMode = request.nextUrl.searchParams.get("mode") === "open" ? "open" : "download";
  const session = await getSession();
  if (!session) return json({ ok: false, message: "Please log in again.", login: `/login?next=${encodeURIComponent("/dashboard/courses")}`, retry: false }, 401);
  const db = getAdminSupabase();
  if (!db) return json({ ok: false, message: "Files are not available right now. Please try again later.", retry: true }, 503);
  if (siteConfig.inWebsiteReader && session.profile?.role !== "admin") return json({ ok: true, href: `/dashboard/read/${id}` }, 200);
  return preparePdf(db, session, id, mode);
}
