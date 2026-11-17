// GET /api/files/<file id>?mode=open|download — older links; the same as
// /api/files/<id>/open and /api/files/<id>/download (src/lib/pdf-route.ts).
import type { NextRequest } from "next/server";
import { handleFileRequest } from "@/lib/pdf-route";

export const preferredRegion = "sin1";
export const maxDuration = 60;

export async function GET(request: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  return handleFileRequest(request, id, request.nextUrl.searchParams.get("mode") === "download" ? "download" : "open");
}
