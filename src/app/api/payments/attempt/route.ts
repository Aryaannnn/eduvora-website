// POST /api/payments/attempt   body: { orderId, outcome: "dismissed" | "failed" }
// The browser tells us the student CLOSED the popup or Razorpay showed a
// failure. We never trust that alone — we ask Razorpay what really happened:
//   paid → 'paid' · Razorpay says failed → 'failed' · nothing paid → hidden 'abandoned'
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { settleAttempt } from "@/lib/payments-server";
import { getAdminSupabase } from "@/lib/supabase/admin";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as { orderId?: unknown; outcome?: unknown };
  if (typeof b.orderId !== "string" || !/^order_[A-Za-z0-9]{6,40}$/.test(b.orderId)) return json({ error: "Invalid order." }, 400);
  const outcome = b.outcome === "failed" ? "failed" : "dismissed";

  const session = await getSession();
  if (!session) return json({ error: "Please log in." }, 401);
  const db = getAdminSupabase();
  if (!db) return json({ error: "Not configured" }, 503);

  const { data: p } = await db
    .from("purchases")
    .select("id,user_id,amount,status,razorpay_order_id,invoice_number")
    .eq("razorpay_order_id", b.orderId)
    .maybeSingle();
  if (!p || p.user_id !== session.user.id) return json({ error: "Not found." }, 404);
  if (!["created", "pending"].includes(p.status)) return json({ status: p.status });

  // Popup closed → may become 'abandoned'. A failure report → only 'failed' if Razorpay agrees
  // (otherwise left hidden; the 30-minute check decides later).
  const res = await settleAttempt(db, p, { allowAbandon: outcome === "dismissed" });
  return json({ status: res.status });
}
