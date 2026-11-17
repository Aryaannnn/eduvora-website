// GET /api/reader/<file id>/<page number>?t=<token>
// ONE page of a course PDF for the secure reader — never the original file.
// Every call checks: login cookie + short-lived token (same student, same file,
// not expired) + access in the database (paid / free / admin), then returns a
// small single-page PDF with the student's watermark burned in, and logs the
// view (Admin → Products → Reading log).
import { siteConfig } from "@/config/site";
import { after, NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { canRead, checkToken, loadOriginal, renderPage } from "@/lib/reader";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const maxDuration = 30;
const DEVICE_COOKIE = "eduvora_rd";

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: NextRequest, ctx: RouteContext<"/api/reader/[fileId]/[page]">) {
  // The in-website reader is switched off (siteConfig.inWebsiteReader) → no page pictures / links at all
  if (!siteConfig.inWebsiteReader) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const { fileId, page } = await ctx.params;
  const n = Number(page);
  if (!Number.isInteger(n) || n < 1 || n > 5000) return fail(400, "Bad page number.");

  const session = await getSession();
  if (!session) return fail(401, "Please log in again.");
  if (!checkToken(request.nextUrl.searchParams.get("t"), session.user.id, fileId)) return fail(401, "This reading session has expired. Please reload the page.");
  const db = getAdminSupabase();
  if (!db) return fail(503, "Reading is not available right now.");

  const isAdmin = session.profile?.role === "admin";
  const access = await canRead(db, { id: session.user.id, isAdmin }, fileId);
  if ("error" in access) return fail(403, access.error === "zip" ? "This file can't be read online." : "You don't have access to this file.");

  let original;
  try {
    original = await loadOriginal(db, access.file);
  } catch (e) {
    console.warn("[reader] could not load the file:", (e as Error).message);
    return fail(503, "This file couldn't be opened right now. Please try again in a moment.");
  }
  if (n > original.pages) return fail(404, "No such page.");

  const viewId = crypto.randomUUID();
  const bytes = await renderPage(original.doc, n, {
    name: session.profile?.full_name || session.user.email?.split("@")[0] || "Student",
    phone: session.profile?.phone ? `+${String(session.profile.phone).replace(/^\+/, "")}` : session.user.phone ? `+${session.user.phone}` : "",
    email: session.profile?.email || session.user.email || "",
    when: new Date(),
    viewId,
  });

  // A random id per browser (to spot one account reading on many devices)
  const device = request.cookies.get(DEVICE_COOKIE)?.value || crypto.randomUUID();
  if (!isAdmin) {
    after(async () => {
      const { error } = await db.from("file_views").insert({
        user_id: session.user.id,
        file_id: access.file.id,
        product_id: access.file.product_id,
        page: n,
        device: device.slice(0, 64),
        user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200) || null,
      });
      if (error) console.warn("[reader] view log failed (run supabase/secure-reader.sql?):", error.message);
    });
  }

  const res = new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Page-Count": String(original.pages),
    },
  });
  if (!request.cookies.get(DEVICE_COOKIE)) res.cookies.set(DEVICE_COOKIE, device, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
