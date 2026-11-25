// GET /api/files/<file id>?mode=open|download — older links; the same as
// /api/files/<id>/open and /api/files/<id>/download (src/lib/pdf-route.ts).
import type { NextRequest } from "next/server";
import { handleFileRequest } from "@/lib/pdf-route";

// Large PDFs: up to 5 minutes (Vercel Fluid compute allows 300 s on every plan)
export const maxDuration = 300;

export async function GET(request: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  return handleFileRequest(request, id, request.nextUrl.searchParams.get("mode") === "download" ? "download" : "open");
}
