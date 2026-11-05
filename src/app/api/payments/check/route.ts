// POST /api/payments/check   body: { purchaseId }
// "Check payment status": asks Razorpay whether a PENDING order was actually
// paid, and if so marks it paid (so no student loses a payment).
// Students can check their own purchases; admins can check any.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { reconcilePurchase } from "@/lib/payments-server";
import { getAdminSupabase } from "@/lib/supabase/admin";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  const { purchaseId } = (await request.json().catch(() => ({}))) as { purchaseId?: unknown };
  if (typeof purchaseId !== "string" || !/^[0-9a-f-]{36}$/i.test(purchaseId)) return json({ error: "Invalid purchase." }, 400);

  const session = await getSession();
  if (!session) return json({ error: "Please log in." }, 401);
  const db = getAdminSupabase();
  if (!db) return json({ error: "Payments are not set up." }, 503);

  const { data: purchase } = await db
    .from("purchases")
    .select("id,user_id,amount,status,razorpay_order_id,invoice_number")
    .eq("id", purchaseId)
    .maybeSingle();
  const isAdmin = session.profile?.role === "admin";
  if (!purchase || (purchase.user_id !== session.user.id && !isAdmin)) return json({ error: "Purchase not found." }, 404);

  const result = await reconcilePurchase(db, purchase);
  return json(result);
}
