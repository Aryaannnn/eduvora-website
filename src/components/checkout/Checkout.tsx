"use client";

// =====================================================================
//  CHECKOUT PIECES — "Apply coupon" box + price breakdown
//  Used by every Buy button (courses, material, tests, packages) and the
//  Book a Slot form. The numbers come from /api/checkout/quote (worked
//  out on the server) — this file never calculates a price itself.
// =====================================================================
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatPrice } from "@/lib/format";
import { postJson } from "@/lib/razorpay-checkout";
import { CloseIcon, ShieldIcon, TagIcon } from "../Icons";
import { Spinner } from "../Spinner";

export type QuoteView = {
  title?: string;
  base: number;
  coupon: { code: string; discount: number } | null;
  couponError: string | null;
  referralDiscount: number;
  rewardUsed: number;
  final: number;
};
type Target = { productId: string } | { slotId: string };

/** Loads the price breakdown for an item; re-checks when a coupon is applied. */
export function useQuote(target: Target | null) {
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [code, setCode] = useState(""); // applied coupon
  const [couponError, setCouponError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const key = target ? JSON.stringify(target) : "";

  const load = useCallback(
    async (coupon: string) => {
      if (!key) return null;
      setLoading(true);
      const res = await postJson("/api/checkout/quote", { ...JSON.parse(key), coupon });
      setLoading(false);
      if (!res.ok) {
        setError(String((res.data as { error?: string }).error ?? "Could not load the price."));
        return null;
      }
      setError("");
      return res.data as QuoteView;
    },
    [key],
  );

  // New item → fresh price without a coupon
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(async () => {
      setCode("");
      setCouponError("");
      const q = await load("");
      if (alive) setQuote(q);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  async function apply(raw: string) {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    const q = await load(c);
    if (!q) return;
    if (q.couponError) return setCouponError(q.couponError); // keep the old price
    setCouponError("");
    setCode(c);
    setQuote(q);
  }
  async function remove() {
    setCode("");
    setCouponError("");
    const q = await load("");
    if (q) setQuote(q);
  }
  return { quote, code, couponError, loading, error, apply, remove };
}

/** "Have a coupon code?" + Apply */
export function CouponBox({ applied, error, loading, onApply, onRemove, disabled = false }: {
  applied: string; error: string; loading: boolean; onApply: (code: string) => void; onRemove: () => void; disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm ring-1 ring-emerald-200">
        <span className="flex items-center gap-1.5 font-bold text-emerald-800"><TagIcon className="h-4 w-4" /> {applied} applied</span>
        <button type="button" onClick={onRemove} disabled={disabled} className="-my-2 inline-flex min-h-11 items-center gap-1 px-1 text-xs font-semibold text-slate-600 hover:text-red-600">
          <CloseIcon className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
    );
  }
  return (
    <div>
      <label htmlFor="coupon-code" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Apply coupon</label>
      <div className="mt-1 flex gap-2">
        <input
          id="coupon-code"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase().replace(/\s/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApply(value);
            }
          }}
          maxLength={30}
          placeholder="Coupon code"
          className="input min-w-0 !py-2.5 uppercase"
          disabled={disabled}
          autoComplete="off"
        />
        <button type="button" onClick={() => onApply(value)} disabled={disabled || loading || !value.trim()} className="btn-light shrink-0 !px-4 !py-2.5 disabled:opacity-60">
          {loading ? <Spinner /> : "Apply"}
        </button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

/** Price → discounts → total */
export function PriceBreakdown({ q }: { q: QuoteView }) {
  const rows: [string, number][] = [];
  if (q.coupon) rows.push([`Coupon ${q.coupon.code}`, q.coupon.discount]);
  if (q.referralDiscount) rows.push(["Referral discount (first payment)", q.referralDiscount]);
  if (q.rewardUsed) rows.push(["Your reward credit", q.rewardUsed]);
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-slate-500">Price</dt><dd className="font-semibold text-slate-900">{formatPrice(q.base)}</dd></div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 text-emerald-700"><dt>{k}</dt><dd className="font-semibold">− ₹{v.toLocaleString("en-IN")}</dd></div>
      ))}
      <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2">
        <dt className="font-semibold text-slate-700">Total</dt>
        <dd className="text-2xl font-extrabold text-slate-900">₹{q.final.toLocaleString("en-IN")}</dd>
      </div>
      {q.final < q.base && <p className="text-right text-xs font-bold text-emerald-700">You save ₹{(q.base - q.final).toLocaleString("en-IN")}</p>}
    </dl>
  );
}

/** Checkout window for courses, material, tests and packages. */
export function CheckoutDialog({ productId, onClose, onPay, paying }: { productId: string; onClose: () => void; onPay: (coupon: string) => void; paying: boolean }) {
  const { quote, code, couponError, loading, error, apply, remove } = useQuote({ productId });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !paying && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, paying]);

  // Rendered on <body>, so cards with animations can't trap the window inside them
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="max-h-[92svh] w-full max-w-md animate-fade-up overflow-y-auto overscroll-contain rounded-t-[1.75rem] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[1.75rem] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Checkout</p>
            <h2 id="checkout-title" className="mt-0.5 text-lg font-extrabold text-slate-900">{quote?.title ?? "Your order"}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={paying} aria-label="Close" className="-mr-1 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><CloseIcon className="h-5 w-5" /></button>
        </div>

        {error ? (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">{error}</p>
        ) : !quote ? (
          <p className="py-10 text-center text-slate-500"><Spinner /> Loading price…</p>
        ) : (
          <>
            <div className="mt-5"><CouponBox applied={code} error={couponError} loading={loading} onApply={apply} onRemove={remove} disabled={paying} /></div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><PriceBreakdown q={quote} /></div>
            <button type="button" onClick={() => onPay(code)} disabled={paying || loading} className="btn-accent mt-5 w-full !py-3.5 text-base disabled:opacity-70">
              {paying ? <><Spinner /> Starting secure payment…</> : `Pay ₹${quote.final.toLocaleString("en-IN")}`}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500">
              <ShieldIcon className="h-3.5 w-3.5 text-emerald-600" /> 100% Secure Payments by Razorpay
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
