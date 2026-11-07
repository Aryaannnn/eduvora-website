// POST /api/admin/ping — "the admin is still active" (sent by AdminIdleGuard
// every few minutes while they use the page). The proxy (src/proxy.ts)
// refreshes the 2-hour inactivity timer on this request; nothing else happens.
import { NextResponse } from "next/server";

export async function POST() {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
