// GET /api/slots — the slot picker refreshes from here every minute.
// Every upcoming 30-minute slot with free / booked (no personal data).
import { connection, NextResponse } from "next/server";
import { getSlotBoard } from "@/lib/slot-board";

export async function GET() {
  await connection(); // always fresh — never prerendered at build time
  const board = await getSlotBoard();
  return NextResponse.json(board, { headers: { "Cache-Control": "private, no-store" } });
}
