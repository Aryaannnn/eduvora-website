"use client";

// =====================================================================
//  BUY BUTTON (Razorpay)
//  • Not logged in → login page, then back to this page (and the payment
//    popup opens automatically)
//  • Already bought → "Go to Dashboard"
//  • Free item      → unlocked at once, no payment
//  • Paid item      → Razorpay popup (navy EDUVORA theme, details pre-filled)
//  The PRICE is decided by the server from the database, never by this file.
// =====================================================================
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { failedUrl, openCheckout, postJson, preloadCheckout } from "@/lib/razorpay-checkout";
import { ShieldIcon } from "./Icons";

// ---- shared (one request per page) list of products this student owns ----
type Owned = { loggedIn: boolean; owned: string[] };
let ownedPromise: Promise<Owned> | null = null;
function getOwned() {
  ownedPromise ??= fetch("/api/payments/owned", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { loggedIn: false, owned: [] }))
    .catch(() => ({ loggedIn: false, owned: [] }));
  return ownedPromise;
}

export default function BuyButton({
  productId,
  label = "Buy Now",
  className = "btn-primary",
  trust = true,
  trustClassName = "",
}: {
  productId: string;
  label?: string;
  className?: string;
  trust?: boolean; // show "100% Secure Payments by Razorpay"
  trustClassName?: string;
}) {
  const router = useRouter();
  const [owned, setOwned] = useState(false);
  // idle → creating (spinner) → paying (popup open) → verifying (spinner) → done / error
  const [phase, setPhase] = useState<"idle" | "creating" | "paying" | "verifying">("idle");
  const [error, setError] = useState("");
  const busy = phase !== "idle";

  // Load the Razorpay script early so the popup opens right away on click
  useEffect(() => {
    void preloadCheckout();
  }, []);

  useEffect(() => {
    let alive = true;
    getOwned().then((o) => {
      if (!alive) return;
      setOwned(o.owned.includes(productId));
      // Came back from login with ?buy=<this product> → continue the purchase
      const url = new URL(window.location.href);
      if (o.loggedIn && url.searchParams.get("buy") === productId && !o.owned.includes(productId)) {
        url.searchParams.delete("buy");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        void buy();
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function buy() {
    setError("");
    setPhase("creating");
    try {
      const res = await postJson("/api/payments/create-order", { productId });
      const data = res.data as Record<string, unknown> & { redirect?: string; error?: string };

      if (res.status === 401) {
        const back = `${window.location.pathname}?buy=${productId}`;
        router.push(`/login?next=${encodeURIComponent(back)}`);
        return setPhase("idle");
      }
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      if (data.redirect) {
        ownedPromise = null;
        router.push(data.redirect); // already owned, or a free item just unlocked
        return;
      }

      const order = data as unknown as Parameters<typeof openCheckout>[0];
      setPhase("paying");
      const result = await openCheckout(order, { verifyUrl: "/api/payments/verify", onVerifying: () => setPhase("verifying") });

      if (result.kind === "paid") {
        ownedPromise = null;
        router.push(result.redirect);
      } else if (result.kind === "dismissed") {
        void postJson("/api/payments/attempt", { orderId: order.orderId, outcome: "dismissed" }); // server re-checks with Razorpay
        setPhase("idle");
      } else if (result.kind === "failed") {
        await postJson("/api/payments/attempt", { orderId: order.orderId, outcome: "failed" });
        router.push(failedUrl(result.reason, order.orderId));
      } else {
        // Paid at Razorpay but our check didn't answer → status page with "Check payment status"
        router.push(failedUrl(result.message, order.orderId));
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  }

  if (owned) {
    return (
      <div className="w-full">
        <a href="/dashboard/courses" className={`${className} !bg-emerald-600 hover:!bg-emerald-700`}>Go to Dashboard</a>
        {trust && <p className={`mt-2 text-center text-xs font-semibold text-emerald-700 ${trustClassName}`}>✓ You already own this</p>}
      </div>
    );
  }

  return (
    <div className="w-full">
      <button type="button" onClick={buy} disabled={busy} className={`${className} disabled:cursor-wait disabled:opacity-70`}>
        {phase === "creating" ? (
          <><Spinner /> Starting payment…</>
        ) : phase === "paying" ? (
          "Complete payment in the Razorpay window"
        ) : phase === "verifying" ? (
          <><Spinner /> Confirming payment…</>
        ) : (
          label
        )}
      </button>
      {trust && (
        <p className={`mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 ${trustClassName}`}>
          <ShieldIcon className="h-3.5 w-3.5 text-emerald-600" /> 100% Secure Payments by Razorpay
        </p>
      )}
      {error && (
        <div className="mt-2 rounded-xl bg-red-50 p-2.5 text-center ring-1 ring-red-200" role="alert">
          <p className="text-xs font-semibold text-red-700">{error}</p>
          <button type="button" onClick={buy} className="mt-1.5 text-xs font-bold text-brand-700 underline">Try Again</button>
        </div>
      )}
    </div>
  );
}

/** "100% Secure Payments by Razorpay" line for layouts where the button is small */
export function SecurePaymentNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 ${className}`}>
      <ShieldIcon className="h-3.5 w-3.5 text-emerald-600" /> 100% Secure Payments by Razorpay
    </p>
  );
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]" aria-hidden />;
}
