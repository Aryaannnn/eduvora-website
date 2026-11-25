// GET /api/files/<file id>/download — the logged-in student's OWN watermarked copy,
// streamed by the server (src/lib/pdf-route.ts). Never a storage link.
import type { NextRequest } from "next/server";
import { handleFileRequest } from "@/lib/pdf-route";

// Large PDFs: up to 5 minutes (Vercel Fluid compute allows 300 s on every plan)
export const maxDuration = 300;

export async function GET(request: NextRequest, ctx: RouteContext<"/api/files/[id]/download">) {
  const { id } = await ctx.params;
  return handleFileRequest(request, id, "download");
}
