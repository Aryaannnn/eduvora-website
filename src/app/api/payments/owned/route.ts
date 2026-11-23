// GET /api/payments/owned — which products has the logged-in student bought?
// The Buy buttons use this to show "Go to Dashboard" instead of "Buy Now".
import { NextResponse } from "next/server";
import { getSession } from "@/lib/dashboard";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getSession();
  if (!session) return NextResponse.json({ loggedIn: false, owned: [] }, { headers });
  const q = (cols: string) => session.supabase.from("purchases").select(cols).eq("user_id", session.user.id).eq("status", "paid");
  let res = await q("product_id,access_until");
  if (res.error) res = await q("product_id"); // access-periods.sql not run yet
  // access ended → not "owned" any more (the Renew / Buy button works again)
  const active = ((res.data ?? []) as unknown as { product_id: string; access_until?: string | null }[]).filter((r) => !r.access_until || new Date(r.access_until).getTime() > Date.now());
  return NextResponse.json({ loggedIn: true, owned: [...new Set(active.map((r) => r.product_id))] }, { headers });
}
