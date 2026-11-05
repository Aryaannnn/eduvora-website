// GET /api/payments/owned — which products has the logged-in student bought?
// The Buy buttons use this to show "Go to Dashboard" instead of "Buy Now".
import { NextResponse } from "next/server";
import { getSession } from "@/lib/dashboard";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getSession();
  if (!session) return NextResponse.json({ loggedIn: false, owned: [] }, { headers });
  const { data } = await session.supabase.from("purchases").select("product_id").eq("user_id", session.user.id).eq("status", "paid");
  return NextResponse.json({ loggedIn: true, owned: [...new Set((data ?? []).map((r) => r.product_id as string))] }, { headers });
}
