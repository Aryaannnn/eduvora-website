// /go/community?from=home — every "Join our WhatsApp community" button points here.
// Counts the click (once per browser per day, so refreshing can't inflate it)
// and opens the community link set in Admin → Settings.
import { after, NextResponse, type NextRequest } from "next/server";
import { COMMUNITY_SOURCES, getCommunityLink, type CommunitySource } from "@/lib/community";
import { getSession } from "@/lib/dashboard";
import { getAdminSupabase } from "@/lib/supabase/admin";

const SEEN = "eduvora_wc";

export async function GET(request: NextRequest) {
  const link = await getCommunityLink();
  if (!link) return NextResponse.redirect(new URL("/", request.url)); // no community yet

  const raw = request.nextUrl.searchParams.get("from") ?? "other";
  const source: CommunitySource = (COMMUNITY_SOURCES as readonly string[]).includes(raw) ? (raw as CommunitySource) : "other";
  const res = NextResponse.redirect(link, 307);
  res.headers.set("Cache-Control", "private, no-store");

  if (!request.cookies.get(SEEN)) {
    res.cookies.set(SEEN, "1", { maxAge: 60 * 60 * 24, httpOnly: true, sameSite: "lax", path: "/" });
    const session = await getSession().catch(() => null);
    const db = getAdminSupabase();
    if (db) {
      after(async () => {
        const { error } = await db.from("community_clicks").insert({ source, user_id: session?.user.id ?? null });
        if (error) console.warn("[community] click not counted:", error.message);
      });
    }
  }
  return res;
}
