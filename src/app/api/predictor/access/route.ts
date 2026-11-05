// GET /api/predictor/access → { allowed, loggedIn }
// Used by the navbar / slideshow to show a small lock icon. No data inside.
import { NextResponse } from "next/server";
import { getPredictorAccess } from "@/lib/predictor-server";

export async function GET() {
  return NextResponse.json(await getPredictorAccess(), { headers: { "Cache-Control": "private, no-store" } });
}
