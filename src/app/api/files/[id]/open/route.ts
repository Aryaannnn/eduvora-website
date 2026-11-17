// GET /api/files/<file id>/open — the logged-in student's OWN watermarked copy,
// streamed by the server (src/lib/pdf-route.ts). Never a storage link.
import type { NextRequest } from "next/server";
import { handleFileRequest } from "@/lib/pdf-route";

// Run next to the database (Supabase: Singapore, ap-southeast-1)
export const preferredRegion = "sin1";
export const maxDuration = 60;

export async function GET(request: NextRequest, ctx: RouteContext<"/api/files/[id]/open">) {
  const { id } = await ctx.params;
  return handleFileRequest(request, id, "open");
}
