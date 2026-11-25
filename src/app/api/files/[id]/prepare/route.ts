// POST /api/files/<file id>/prepare — the "Download" button gets the student's
// watermarked copy ready first (JSON answer), so the page can show "Preparing…"
// and a friendly "Try again" if it fails. No file bytes and no storage link here.
import type { NextRequest } from "next/server";
import { handlePrepareRequest } from "@/lib/pdf-route";

// Large PDFs: up to 5 minutes (Vercel Fluid compute allows 300 s on every plan)
export const maxDuration = 300;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/files/[id]/prepare">) {
  const { id } = await ctx.params;
  return handlePrepareRequest(request, id);
}
