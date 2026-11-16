// POST /api/reader/<file id>/pages   { t: "<token>", pages: [3, 4] }
// Fast reader: 60-second signed links to the pre-made WebP pictures of at most
// 3 pages (the page being read + the next one). Every call checks the login,
// the short-lived reading token and the student's access, and logs the pages.
// The original PDF is never sent. The student's watermark is drawn on top in
// the browser.
import { after, NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { PAGES_BUCKET, pagePath } from "@/lib/pdf-pages";
import { canRead, checkToken, pageInfo } from "@/lib/reader";
import { getAdminSupabase } from "@/lib/supabase/admin";

const LINK_SECONDS = 60;
const DEVICE_COOKIE = "eduvora_rd";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest, ctx: RouteContext<"/api/reader/[fileId]/pages">) {
  const { fileId } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { t?: string; pages?: unknown };
  const session = await getSession();
  if (!session) return json({ error: "Please log in again." }, 401);
  if (!checkToken(typeof body.t === "string" ? body.t : null, session.user.id, fileId)) return json({ error: "This reading session has expired. Please reload the page." }, 401);
  const db = getAdminSupabase();
  if (!db) return json({ error: "Reading is not available right now." }, 503);

  const isAdmin = session.profile?.role === "admin";
  const access = await canRead(db, { id: session.user.id, isAdmin }, fileId);
  if ("error" in access) return json({ error: "You don't have access to this file." }, 403);
  const info = await pageInfo(db, fileId);
  if (!info?.ready) return json({ error: "This file is being prepared. Please reload in a minute." }, 409);

  const wanted = [...new Set((Array.isArray(body.pages) ? body.pages : []).map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= info.pages)
    .slice(0, 3);
  if (wanted.length === 0) return json({ error: "No such page." }, 400);

  const { data: signed, error } = await db.storage.from(PAGES_BUCKET).createSignedUrls(wanted.map((n) => pagePath(fileId, info.version, n)), LINK_SECONDS);
  if (error || !signed) return json({ error: "This page couldn't be loaded. Please try again." }, 502);
  const urls: Record<number, string> = {};
  signed.forEach((x, i) => {
    if (x.signedUrl) urls[wanted[i]] = x.signedUrl;
  });

  // Reading log (students only) — one row per page sent
  const device = request.cookies.get(DEVICE_COOKIE)?.value || crypto.randomUUID();
  if (!isAdmin) {
    after(async () => {
      const ua = (request.headers.get("user-agent") ?? "").slice(0, 200) || null;
      const { error: logErr } = await db.from("file_views").insert(
        Object.keys(urls).map((n) => ({ user_id: session.user.id, file_id: fileId, product_id: access.file.product_id, page: Number(n), device: device.slice(0, 64), user_agent: ua })),
      );
      if (logErr) console.warn("[reader] view log failed:", logErr.message);
    });
  }
  const res = json({ urls, version: info.version, expiresIn: LINK_SECONDS });
  if (!request.cookies.get(DEVICE_COOKIE)) res.cookies.set(DEVICE_COOKIE, device, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
