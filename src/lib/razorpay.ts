// =====================================================================
//  RAZORPAY HELPERS — SERVER ONLY
//  Keys come from .env.local: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
//  RAZORPAY_WEBHOOK_SECRET. The secret never reaches the browser.
// =====================================================================
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const keyId = () => process.env.RAZORPAY_KEY_ID ?? "";
const keySecret = () => process.env.RAZORPAY_KEY_SECRET ?? "";

export const isRazorpayConfigured = () => keyId().length > 5 && keySecret().length > 5;

export type RazorpayOrder = { id: string; amount: number; currency: string; receipt: string; status: string };

/** Creates an order on Razorpay. amountRupees comes from OUR database, never the browser. */
export async function createRazorpayOrder(amountRupees: number, receipt: string, notes: Record<string, string>): Promise<RazorpayOrder> {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString("base64")}`,
    },
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: "INR", receipt: receipt.slice(0, 40), notes }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay order failed (${res.status}): ${body?.error?.description ?? "unknown error"}`);
  return body as RazorpayOrder;
}

const authHeader = () => `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString("base64")}`;

export type OrderOutcome =
  | { kind: "paid"; paymentId: string; amount: number }
  | { kind: "failed"; reason: string }
  | { kind: "in_progress" } // a payment was started (e.g. UPI waiting for approval)
  | { kind: "none" } // nobody tried to pay
  | { kind: "error"; message: string };

/**
 * What really happened to this Razorpay order? (asked from OUR server)
 *   captured   → paid
 *   authorized → money held: we capture it now → paid
 *   created    → still in progress
 *   failed     → failed (only when Razorpay itself says so)
 */
export async function getOrderOutcome(orderId: string): Promise<OrderOutcome> {
  if (!isRazorpayConfigured()) return { kind: "error", message: "Razorpay keys missing" };
  try {
    const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, { headers: { Authorization: authHeader() }, cache: "no-store" });
    const body = await res.json();
    if (!res.ok) return { kind: "error", message: body?.error?.description ?? `HTTP ${res.status}` };
    const items = (body.items ?? []) as { id: string; status: string; amount: number; currency: string; error_description?: string | null; created_at: number }[];
    const captured = items.find((p) => p.status === "captured");
    if (captured) return { kind: "paid", paymentId: captured.id, amount: captured.amount };
    const authorized = items.find((p) => p.status === "authorized");
    if (authorized) {
      const cap = await fetch(`https://api.razorpay.com/v1/payments/${authorized.id}/capture`, {
        method: "POST",
        headers: { Authorization: authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ amount: authorized.amount, currency: authorized.currency }),
        cache: "no-store",
      });
      if (cap.ok) return { kind: "paid", paymentId: authorized.id, amount: authorized.amount };
      return { kind: "error", message: "Payment is authorised but could not be captured yet" };
    }
    if (items.some((p) => p.status === "created")) return { kind: "in_progress" };
    const failed = items.filter((p) => p.status === "failed").sort((x, y) => y.created_at - x.created_at)[0];
    if (failed) return { kind: "failed", reason: (failed.error_description || "Payment failed").slice(0, 300) };
    return { kind: "none" };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}

/** How the student paid: "UPI", "Card", "Net Banking", "Wallet"… (null if unknown) */
export async function getPaymentMethod(paymentId: string): Promise<string | null> {
  if (!isRazorpayConfigured() || !paymentId) return null;
  try {
    const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: authHeader() }, cache: "no-store" });
    if (!res.ok) return null;
    const p = (await res.json()) as { method?: string; bank?: string | null; wallet?: string | null; vpa?: string | null; card?: { network?: string; last4?: string } | null };
    switch (p.method) {
      case "upi": return "UPI";
      case "card": return p.card?.network ? `Card (${p.card.network}${p.card.last4 ? ` ····${p.card.last4}` : ""})` : "Card";
      case "netbanking": return p.bank ? `Net Banking (${p.bank})` : "Net Banking";
      case "wallet": return p.wallet ? `Wallet (${p.wallet})` : "Wallet";
      case "emi": return "EMI";
      default: return p.method ? p.method.toUpperCase() : null;
    }
  } catch {
    return null;
  }
}

/** When the Razorpay order was created (null if unknown) */
export async function orderCreatedAt(orderId: string): Promise<Date | null> {
  if (!isRazorpayConfigured()) return null;
  try {
    const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: authHeader() }, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { created_at?: number };
    return body.created_at ? new Date(body.created_at * 1000) : null;
  } catch {
    return null;
  }
}

function safeEqualHex(expected: string, received: string) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received ?? "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checks the signature Razorpay gives the browser after a successful payment. */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  if (!keySecret() || !orderId || !paymentId || !signature) return false;
  const expected = createHmac("sha256", keySecret()).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Checks that a webhook really came from Razorpay. */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export const isWebhookConfigured = () => (process.env.RAZORPAY_WEBHOOK_SECRET ?? "").length > 0;
