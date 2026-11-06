// =====================================================================
//  CHECKOUT PRICE — SERVER ONLY
//  Works out what the student really pays. The browser only sends the
//  item and the coupon code; every number below comes from our database.
//
//   price
//   − coupon            (Admin → Coupons)
//   − referral discount (first payment of a student who joined with a link)
//   − reward credit     (₹ earned by referring friends)
//   = final price       (never below ₹1 — Razorpay needs at least ₹1)
//
//  Tables/functions come from supabase/coupons-referrals.sql. Until that
//  file is run, prices are simply the normal prices.
// =====================================================================
import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Target = { kind: "product"; id: string; price: number } | { kind: "slot"; id: string; price: number };

export type Quote = {
  base: number;
  coupon: { id: string; code: string; discount: number } | null;
  couponError: string | null;
  referralDiscount: number;
  rewardUsed: number;
  final: number;
};

type Coupon = {
  id: string; code: string; discount_type: "percent" | "flat"; discount_value: number; max_discount: number | null; min_amount: number;
  applies_to: "all" | "selected"; product_ids: string[]; include_slots: boolean; starts_at: string | null; ends_at: string | null;
  max_uses: number | null; once_per_student: boolean; is_active: boolean;
};

export const normaliseCode = (c: unknown) => (typeof c === "string" ? c.trim().toUpperCase().replace(/\s+/g, "").slice(0, 30) : "");
const recent = () => new Date(Date.now() - 30 * 60 * 1000).toISOString(); // checkouts started in the last 30 min hold a coupon use

async function checkCoupon(db: SupabaseClient, userId: string, target: Target, code: string): Promise<{ coupon: Coupon; discount: number } | string> {
  const { data, error } = await db.from("coupons").select("*").eq("code", code).maybeSingle();
  if (error) return /coupons/.test(error.message) ? "Coupons are not available yet." : "Could not check this coupon. Please try again.";
  const c = data as Coupon | null;
  if (!c || !c.is_active) return "This coupon code is not valid.";
  const now = Date.now();
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return "This coupon is not active yet.";
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return "This coupon has expired.";
  if (target.kind === "slot" ? !c.include_slots : c.applies_to === "selected" && !c.product_ids.includes(target.id)) return "This coupon can't be used for this item.";
  if (target.price < c.min_amount) return `This coupon needs a minimum amount of ₹${c.min_amount.toLocaleString("en-IN")}.`;

  // uses = used + checkouts in progress (last 30 minutes)
  if (c.max_uses) {
    const { count } = await db
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", c.id)
      .or(`status.eq.used,and(status.eq.pending,created_at.gt."${recent()}")`);
    if ((count ?? 0) >= c.max_uses) return "This coupon has reached its usage limit.";
  }
  if (c.once_per_student) {
    const { count } = await db
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", c.id)
      .eq("user_id", userId)
      .or(`status.eq.used,and(status.eq.pending,created_at.gt."${recent()}")`);
    if ((count ?? 0) > 0) return "You have already used this coupon.";
  }
  let discount = c.discount_type === "percent" ? Math.floor((target.price * c.discount_value) / 100) : c.discount_value;
  if (c.max_discount) discount = Math.min(discount, c.max_discount);
  return { coupon: c, discount };
}

/** Referral ₹ off: only for a referred student's FIRST paid payment. */
async function referralDiscountFor(db: SupabaseClient, userId: string): Promise<number> {
  const { data: r, error } = await db.from("referrals").select("referred_discount,status").eq("referred_id", userId).maybeSingle();
  if (error || !r || r.status !== "joined" || !(r.referred_discount > 0)) return 0;
  const [{ data: s }, p, b] = await Promise.all([
    db.from("referral_settings").select("enabled").eq("id", 1).maybeSingle(),
    db.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["paid", "refunded"]).gt("amount", 0),
    db.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", userId).in("payment_status", ["paid", "refunded"]).gt("amount", 0),
  ]);
  if (!s?.enabled || (p.count ?? 0) > 0 || (b.count ?? 0) > 0) return 0;
  return Number(r.referred_discount);
}

/** The full price breakdown for one item (server only, service-role client). */
export async function quote(db: SupabaseClient, userId: string, target: Target, rawCode?: unknown): Promise<Quote> {
  const base = Math.max(0, Math.round(target.price));
  const empty: Quote = { base, coupon: null, couponError: null, referralDiscount: 0, rewardUsed: 0, final: base };
  if (base <= 1) return empty; // free / ₹1 items: nothing to discount

  let left = base - 1; // the most we can take off (final ≥ ₹1)
  const q = { ...empty };

  const code = normaliseCode(rawCode);
  if (code) {
    const res = await checkCoupon(db, userId, target, code);
    if (typeof res === "string") q.couponError = res;
    else {
      const d = Math.min(res.discount, left);
      q.coupon = { id: res.coupon.id, code: res.coupon.code, discount: d };
      left -= d;
    }
  }

  q.referralDiscount = Math.min(await referralDiscountFor(db, userId), left);
  left -= q.referralDiscount;

  if (left > 0) {
    const { data, error } = await db.rpc("reward_available", { p_user: userId });
    if (!error) q.rewardUsed = Math.min(Math.max(0, Number(data) || 0), left);
  }
  q.final = base - (q.coupon?.discount ?? 0) - q.referralDiscount - q.rewardUsed;
  return q;
}

/** Columns to save on the purchase / booking (only when something was taken off). */
export function discountColumns(q: Quote) {
  if (q.final === q.base) return {};
  return {
    original_amount: q.base,
    coupon_id: q.coupon?.id ?? null,
    coupon_code: q.coupon?.code ?? null,
    coupon_discount: q.coupon?.discount ?? 0,
    referral_discount: q.referralDiscount,
    reward_used: q.rewardUsed,
  };
}

/** Remember the coupon use (pending until paid; triggers mark it used / cancelled). */
export async function recordCouponUse(db: SupabaseClient, userId: string, q: Quote, ref: { purchaseId?: string; bookingId?: string }) {
  if (!q.coupon) return;
  const { error } = await db.from("coupon_redemptions").insert({
    coupon_id: q.coupon.id,
    user_id: userId,
    purchase_id: ref.purchaseId ?? null,
    booking_id: ref.bookingId ?? null,
    discount: q.coupon.discount,
  });
  if (error) console.warn("[coupon] could not record use:", error.message);
}

// ---------------------------------------------------------------- REFERRALS
export const REF_COOKIE = "eduvora_ref";

/**
 * If this visitor came through a referral link (cookie set by /r/<code>),
 * link their account to the referrer. Safe to call often: the database
 * ignores it for old accounts, self-referrals and students already linked.
 */
export async function claimReferralFromCookie(db: SupabaseClient | null, userId: string) {
  if (!db) return;
  try {
    const code = normaliseCode((await cookies()).get(REF_COOKIE)?.value);
    if (!code) return;
    const { error } = await db.rpc("claim_referral", { p_user: userId, p_code: code });
    if (error && !/claim_referral|function/i.test(error.message)) console.warn("[referral] claim:", error.message);
  } catch {
    /* outside a request */
  }
}
