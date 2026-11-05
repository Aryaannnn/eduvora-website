// =====================================================================
//  SAVING PAYMENTS — SERVER ONLY (uses the service role key, so Row
//  Level Security can't block it)
//
//  Purchase statuses:
//    created    HIDDEN — Razorpay order made / popup opened, not paid yet
//    paid       shown  — money received, item unlocked, invoice number
//    failed     shown  — ONLY when Razorpay itself reports a failure
//    abandoned  HIDDEN — popup closed / nobody paid (checked with Razorpay)
//    pending    old name for "created" (treated the same)
//
//  settleAttempt() is the one place that turns a hidden attempt into
//  paid / failed / abandoned, always after asking Razorpay first.
// =====================================================================
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { yearInIndia } from "./format";
import { releaseStaleHolds } from "./bookings-server";
import { notifyPurchasePaid } from "./email/notify";
import { getOrderOutcome } from "./razorpay";

export const HIDDEN_STATUSES = ["created", "pending", "abandoned"] as const;
export const OPEN_ATTEMPT_STATUSES = ["created", "pending"] as const; // not decided yet
export const ABANDON_AFTER_MINUTES = 30;

type Status = "created" | "pending" | "paid" | "failed" | "abandoned";
type PurchaseRow = { id: string; user_id: string; amount: number; status: Status; razorpay_order_id: string | null; invoice_number: string | null };

const missingFunction = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST202" || /could not find the function/i.test(e.message ?? ""));

async function nextInvoice(db: SupabaseClient) {
  const { data, error } = await db.rpc("next_invoice_number");
  if (!error && typeof data === "string") return data;
  // Fallback (payments.sql not run yet): still unique, still starts with EDU-<year>-
  return `EDU-${yearInIndia()}-${Date.now().toString(36).toUpperCase()}`;
}

export async function markPurchasePaid(db: SupabaseClient, orderId: string, paymentId: string | null): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await db.rpc("mark_purchase_paid", { p_order_id: orderId, p_payment_id: paymentId });
  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as { id: string } | undefined;
    if (row?.id) notifyPurchasePaid(row.id); // receipt + invoice email (sent once)
    return { id: row?.id ?? null, error: null };
  }
  if (!missingFunction(error)) return { id: null, error: error.message };

  // ---- Fallback: direct update with the service role key ----
  console.warn("[payments] mark_purchase_paid() missing — run supabase/payments.sql. Using fallback update.");
  const { data: p } = await db.from("purchases").select("id,status,invoice_number").eq("razorpay_order_id", orderId).maybeSingle();
  if (!p) return { id: null, error: "Order not found" };
  if (p.status === "paid") return { id: p.id, error: null };
  const patch: Record<string, unknown> = { status: "paid", invoice_number: p.invoice_number ?? (await nextInvoice(db)) };
  if (paymentId) patch.razorpay_payment_id = paymentId;
  let { error: e2 } = await db.from("purchases").update({ ...patch, paid_at: new Date().toISOString() }).eq("id", p.id).neq("status", "paid");
  if (e2 && /paid_at/.test(e2.message)) ({ error: e2 } = await db.from("purchases").update(patch).eq("id", p.id).neq("status", "paid"));
  if (!e2) notifyPurchasePaid(p.id);
  return { id: p.id, error: e2?.message ?? null };
}

export type SettleResult = { status: Status; message: string; purchaseId: string };

/**
 * Ask Razorpay what happened to this attempt and save the answer.
 *   paid at Razorpay        → 'paid' (item unlocked, invoice number)
 *   Razorpay says failed    → 'failed' (with the reason)
 *   nothing paid / no try   → 'abandoned' — only if `allowAbandon` (popup
 *                             closed, or older than 30 minutes)
 *   still in progress / Razorpay unreachable → left as it is
 */
export async function settleAttempt(db: SupabaseClient, p: PurchaseRow, opts: { allowAbandon: boolean }): Promise<SettleResult> {
  const r = (status: Status, message: string): SettleResult => ({ status, message, purchaseId: p.id });
  if (p.status === "paid") return r("paid", "This payment is already confirmed.");
  if (!p.razorpay_order_id) return r(p.status, "This purchase has no online (Razorpay) payment to check.");

  const out = await getOrderOutcome(p.razorpay_order_id);
  const stamp = { checked_at: new Date().toISOString() };

  if (out.kind === "paid") {
    if (out.amount !== p.amount * 100) return r(p.status, "The paid amount does not match this order. Please check it in Razorpay.");
    const saved = await markPurchasePaid(db, p.razorpay_order_id, out.paymentId);
    return saved.error ? r(p.status, `Payment found but could not be saved: ${saved.error}`) : r("paid", "Payment found and confirmed! The item is unlocked.");
  }
  if (out.kind === "failed") {
    const { error } = await update(db, p.id, { status: "failed", failure_reason: out.reason, ...stamp });
    return error ? r(p.status, error) : r("failed", `Razorpay reports this payment failed: ${out.reason}`);
  }
  if (out.kind === "none" && opts.allowAbandon) {
    if (p.status === "abandoned") return r("abandoned", "Razorpay has no payment for this order — the student did not pay.");
    const { error } = await update(db, p.id, { status: "abandoned", ...stamp });
    return error ? r(p.status, error) : r("abandoned", "No payment was made — attempt hidden as abandoned.");
  }
  await update(db, p.id, stamp); // remember we looked
  if (out.kind === "error") return r(p.status, `Could not reach Razorpay: ${out.message}`);
  if (out.kind === "in_progress") return r(p.status, "A payment is still in progress at Razorpay. Check again in a few minutes.");
  return r(p.status, "Razorpay has no payment for this order yet.");
}

/** Update a purchase, tolerating columns that only exist after the newest SQL. */
async function update(db: SupabaseClient, id: string, patch: Record<string, unknown>) {
  let { error } = await db.from("purchases").update(patch).eq("id", id).neq("status", "paid");
  for (const col of ["checked_at", "failure_reason"]) {
    if (error && error.message.includes(col)) {
      delete patch[col];
      if (Object.keys(patch).length === 0) return { error: null };
      ({ error } = await db.from("purchases").update(patch).eq("id", id).neq("status", "paid"));
    }
  }
  if (error && /status_check/.test(error.message)) return { error: "Run supabase/payment-statuses.sql in Supabase first." };
  return { error: error?.message ?? null };
}

/** "Check with Razorpay" button (support) */
export async function reconcilePurchase(db: SupabaseClient, p: PurchaseRow): Promise<SettleResult> {
  return settleAttempt(db, p, { allowAbandon: true });
}

// =====================================================================
//  AUTOMATIC CHECK — every unfinished attempt is checked with Razorpay:
//    paid / failed  → saved straight away (shows in the lists)
//    nobody paid    → 'abandoned' only once it is older than 30 minutes
//  Runs when Admin → Payments opens, after each new order (background),
//  and from /api/cron/payments (scheduler, once the site is online).
// =====================================================================
export type SweepSummary = { checked: number; paid: number; failed: number; abandoned: number; skipped: number };

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

export async function sweepStalePayments(db: SupabaseClient, opts: { userId?: string; limit?: number; olderThanMinutes?: number } = {}): Promise<SweepSummary> {
  const sum: SweepSummary = { checked: 0, paid: 0, failed: 0, abandoned: 0, skipped: 0 };
  const cutoff = new Date(Date.now() - (opts.olderThanMinutes ?? ABANDON_AFTER_MINUTES) * 60_000).toISOString();

  let q = db
    .from("purchases")
    .select("id,user_id,amount,status,razorpay_order_id,invoice_number,created_at")
    .in("status", [...OPEN_ATTEMPT_STATUSES])
    .not("razorpay_order_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 25);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data } = await q;

  await inBatches((data ?? []) as (PurchaseRow & { created_at: string })[], 5, async (p) => {
    sum.checked++;
    const res = await settleAttempt(db, p, { allowAbandon: new Date(p.created_at) < new Date(cutoff) });
    if (res.status === "paid") sum.paid++;
    else if (res.status === "failed") sum.failed++;
    else if (res.status === "abandoned") sum.abandoned++;
    else sum.skipped++;
  });

  // ---------- counselling slot holds past their 10 minutes ----------
  // (asks Razorpay first: paid → booking confirmed, otherwise the slot is freed)
  const holds = await releaseStaleHolds(db, opts.limit ?? 25);
  sum.paid += holds.paid;
  sum.abandoned += holds.released;
  sum.checked += holds.paid + holds.released;

  if (sum.checked) console.log(`[payments] check: ${sum.checked} checked · ${sum.paid} paid · ${sum.failed} failed · ${sum.abandoned} abandoned · ${sum.skipped} left`);
  return sum;
}
