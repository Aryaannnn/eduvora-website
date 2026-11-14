"use client";

// =====================================================================
//  BUY BUTTON (Razorpay)
//  • Not logged in → login page, then back to this page (and the payment
//    popup opens automatically)
//  • Already bought → "Go to Dashboard"
//  • Free item      → (log in first) unlocked at once, no payment, opens My Courses
//  • Paid item      → checkout window ("Apply coupon", referral / reward
//                     discounts, total) → "Pay ₹…" → Razorpay popup
//  The PRICE is decided by the server from the database, never by this file.
// =====================================================================
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { failedUrl, openCheckout, postJson, preloadCheckout } from "@/lib/razorpay-checkout";
import { ShieldIcon } from "./Icons";
import RefundNote, { type RefundKind } from "./RefundNote";
import dynamic from "next/dynamic";
import { Spinner } from "./Spinner";
import { track } from "@/lib/analytics";

// The checkout window is only downloaded when someone clicks Buy (keeps pages light)
const CheckoutDialog = dynamic(() => import("./checkout/Checkout").then((m) => m.CheckoutDialog), { ssr: false });

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
  free = false,
  ownedHref,
  ownedLabel,
  ownedNote,
  refundKind = "digital",
}: {
  /** which refund rule to show under the button (live crash courses → "live") */
  refundKind?: RefundKind;
  productId: string;
  label?: string;
  className?: string;
  trust?: boolean; // show "100% Secure Payments by Razorpay"
  trustClassName?: string;
  /** free item: no payment wording, "log in to unlock" hint */
  free?: boolean;
  /** where the button goes once the student owns it (e.g. packages → "Book a Session") */
  ownedHref?: string;
  ownedLabel?: string;
  ownedNote?: string;
}) {
  const router = useRouter();
  const [owned, setOwned] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkout, setCheckout] = useState(false); // checkout window open
  // idle → creating (spinner) → paying (popup open) → verifying (spinner) → done / error
  const [phase, setPhase] = useState<"idle" | "creating" | "paying" | "verifying">("idle");
  const [error, setError] = useState("");
  const busy = phase !== "idle";

  // Load the Razorpay script as soon as someone shows interest (hover / touch / keyboard focus),
  // so the popup still opens right away — but pages don't download it for every visitor.
  const warmUp = () => {
    if (!free) void preloadCheckout();
  };

  useEffect(() => {
    let alive = true;
    getOwned().then((o) => {
      if (!alive) return;
      setOwned(o.owned.includes(productId));
      setLoggedIn(o.loggedIn);
      // Came back from login with ?buy=<this product> → continue the purchase
      const url = new URL(window.location.href);
      if (o.loggedIn && url.searchParams.get("buy") === productId && !o.owned.includes(productId)) {
        url.searchParams.delete("buy");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        if (free) void buy();
        else setCheckout(true); // back from login → straight to the checkout window
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Click: free → unlock now · logged out → login · paid → checkout window
  function start() {
    setError("");
    if (free) track("free_resource", { action: "unlock", item_id: productId });
    else track("buy_click", { item_id: productId });
    if (free || !loggedIn) return void buy();
    setCheckout(true);
  }

  async function buy(coupon = "") {
    setError("");
    setPhase("creating");
    try {
      const res = await postJson("/api/payments/create-order", { productId, coupon });
      const data = res.data as Record<string, unknown> & { redirect?: string; error?: string };

      if (res.status === 401) {
        const back = `${window.location.pathname}?buy=${productId}`;
        router.push(`/login?next=${encodeURIComponent(back)}`);
        return setPhase("idle");
      }
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setCheckout(false);
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
      setCheckout(false);
      setError((e as Error).message);
      setPhase("idle");
    }
  }

  if (owned && ownedHref) {
    return (
      <div className="w-full">
        <a href={ownedHref} className={`${className} !bg-emerald-700 !text-white hover:!bg-emerald-800`}>{ownedLabel ?? "Open"}</a>
        {ownedNote && <p className={`mt-2 text-center text-xs font-semibold text-emerald-600 ${trustClassName}`}>{ownedNote}</p>}
      </div>
    );
  }
  if (owned) {
    return (
      <div className="w-full">
        <a href={free ? `/dashboard/courses?unlocked=${productId}#item-${productId}` : "/dashboard/courses"} className={`${className} !bg-emerald-600 hover:!bg-emerald-700`}>{free ? "Open in My Courses" : "Go to Dashboard"}</a>
        {(trust || free) && <p className={`mt-2 text-center text-xs font-semibold text-emerald-700 ${trustClassName}`}>✓ {free ? "Unlocked — it's in your dashboard" : "You already own this"}</p>}
      </div>
    );
  }

  return (
    <div className="w-full">
      {checkout && <CheckoutDialog productId={productId} paying={phase === "creating"} onClose={() => setCheckout(false)} onPay={(c) => void buy(c)} />}
      <button type="button" onClick={start} onPointerEnter={warmUp} onTouchStart={warmUp} onFocus={warmUp} disabled={busy} className={`${className} disabled:cursor-wait disabled:opacity-70`}>
        {phase === "creating" ? (
          <><Spinner /> {free ? "Unlocking…" : "Starting payment…"}</>
        ) : phase === "paying" ? (
          "Complete payment in the Razorpay window"
        ) : phase === "verifying" ? (
          <><Spinner /> Confirming payment…</>
        ) : (
          label
        )}
      </button>
      {free && <p className={`mt-2 text-center text-[11px] font-semibold text-slate-500 ${trustClassName}`}>Free · just log in or sign up to unlock</p>}
      {trust && !free && (
        <>
          <p className={`mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 ${trustClassName}`}>
            <ShieldIcon className="h-3.5 w-3.5 text-emerald-600" /> 100% Secure Payments by Razorpay
          </p>
          <RefundNote kind={refundKind} className="mt-1" />
        </>
      )}
      {error && (
        <div className="mt-2 rounded-xl bg-red-50 p-2.5 text-center ring-1 ring-red-200" role="alert">
          <p className="text-xs font-semibold text-red-700">{error}</p>
          <button type="button" onClick={start} className="mt-1.5 text-xs font-bold text-brand-700 underline">Try Again</button>
        </div>
      )}
    </div>
  );
}

/** "100% Secure Payments by Razorpay" line for layouts where the button is small */
export function SecurePaymentNote({ className = "", refundKind = "digital" }: { className?: string; refundKind?: RefundKind }) {
  return (
    <div className={className}>
      <p className="flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-500">
        <ShieldIcon className="h-3.5 w-3.5 text-emerald-600" /> 100% Secure Payments by Razorpay
      </p>
      <RefundNote kind={refundKind} className="mt-1" />
    </div>
  );
}


