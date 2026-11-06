// GET /api/bookings/credits → { loggedIn, credits: { total, used, remaining, unlimited } | null }
// Used by the booking form to offer "Book with 1 session credit".
import { NextResponse } from "next/server";
import { getSession } from "@/lib/dashboard";
import { getCredits } from "@/lib/packages";

export async function GET() {
  const session = await getSession();
  const credits = session ? await getCredits(session.supabase) : null;
  return NextResponse.json({ loggedIn: !!session, credits }, { headers: { "Cache-Control": "private, no-store" } });
}
