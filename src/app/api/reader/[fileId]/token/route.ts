// POST /api/reader/<file id>/token — a fresh 5-minute reading token
// (the reader asks every few minutes). Access is checked again each time.
import { siteConfig } from "@/config/site";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/dashboard";
import { canRead, makeToken } from "@/lib/reader";
import { getAdminSupabase } from "@/lib/supabase/admin";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(_request: Request, ctx: RouteContext<"/api/reader/[fileId]/token">) {
  // The in-website reader is switched off (siteConfig.inWebsiteReader) → no page pictures / links at all
  if (!siteConfig.inWebsiteReader) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const { fileId } = await ctx.params;
  const session = await getSession();
  if (!session) return json({ error: "Please log in again." }, 401);
  const db = getAdminSupabase();
  if (!db) return json({ error: "Reading is not available right now." }, 503);
  const access = await canRead(db, { id: session.user.id, isAdmin: session.profile?.role === "admin" }, fileId);
  if ("error" in access) return json({ error: "You don't have access to this file." }, 403);
  return json(makeToken(session.user.id, fileId));
}
