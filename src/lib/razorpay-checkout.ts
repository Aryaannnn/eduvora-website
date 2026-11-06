// =====================================================================
//  RAZORPAY CHECKOUT POPUP (browser) — shared by "Buy Now" and "Pay & Book".
//  The amount always comes from OUR server.
//
//  Why buttons used to get stuck on "Please wait…":
//   • the Razorpay script only started loading AFTER the click, and
//   • if the "verify payment" request failed or hung, the code waited forever.
//  Now: the script is pre-loaded when the page opens, every request has a
//  time limit, and openCheckout() ALWAYS finishes with a clear result.
// =====================================================================
import { appOrigin } from "./site-url";

export type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; close: () => void; on: (event: string, cb: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export type ServerOrder = {
  orderId: string;
  amount: number; // paise
  currency: string;
  keyId: string;
  title: string;
  prefill: { name: string; email: string; contact: string };
};

export type CheckoutResult =
  | { kind: "paid"; redirect: string } // verified by our server
  | { kind: "dismissed" } // popup closed without paying
  | { kind: "failed"; reason: string } // Razorpay reported a failure
  | { kind: "verify_error"; message: string }; // paid at Razorpay, but our check didn't answer

// ---------- script loading (once, shared) ----------
let scriptPromise: Promise<boolean> | null = null;
export function preloadCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  scriptPromise ??= new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(!!window.Razorpay);
    s.onerror = () => {
      scriptPromise = null; // allow another try
      resolve(false);
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/** POST JSON with a time limit. Never hangs. */
export async function postJson(url: string, body: unknown, timeoutMs = 20000): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    const timedOut = (e as Error).name === "AbortError";
    return { ok: false, status: 0, data: { error: timedOut ? "The server took too long to answer. Please check your internet and try again." : "Could not reach the server. Please check your internet and try again." } };
  } finally {
    clearTimeout(t);
  }
}

export const failedUrl = (reason?: string, orderId?: string) =>
  `/payment-failed?back=${encodeURIComponent(window.location.pathname)}${orderId ? `&order=${encodeURIComponent(orderId)}` : ""}${reason ? `&reason=${encodeURIComponent(reason.slice(0, 200))}` : ""}`;

/**
 * Opens the EDUVORA-themed popup and resolves ONCE with what happened.
 * After a payment, Razorpay's reply is sent to `verifyUrl` (our server checks the signature).
 */
export async function openCheckout(
  order: ServerOrder,
  opts: { verifyUrl: string; timeoutSeconds?: number; onVerifying?: () => void },
): Promise<CheckoutResult> {
  if (!(await preloadCheckout()) || !window.Razorpay) {
    throw new Error("Could not load the Razorpay payment window. Check your internet (or turn off an ad-blocker) and try again.");
  }
  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    const finish = (r: CheckoutResult) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "EDUVORA",
      description: order.title,
      image: `${appOrigin()}/logo-compact.png`,
      prefill: order.prefill,
      theme: { color: "#0b2a5b" }, // EDUVORA navy
      ...(opts.timeoutSeconds ? { timeout: opts.timeoutSeconds } : {}),
      handler: async (r: RazorpayResponse) => {
        settled = true; // closing the popup now no longer counts as "dismissed"
        opts.onVerifying?.();
        const v = await postJson(opts.verifyUrl, r, 30000);
        if ((v.ok || v.status === 202) && typeof v.data.redirect === "string") resolve({ kind: "paid", redirect: v.data.redirect });
        else resolve({ kind: "verify_error", message: String(v.data.error ?? "We could not confirm the payment yet.") });
      },
      modal: { ondismiss: () => finish({ kind: "dismissed" }), confirm_close: true },
    });
    rzp.on("payment.failed", (r) => {
      finish({ kind: "failed", reason: r.error?.description || "Payment failed" });
      try {
        rzp.close();
      } catch {
        /* already closed */
      }
    });
    rzp.open();
  });
}
