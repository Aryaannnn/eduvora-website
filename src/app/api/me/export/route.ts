// GET /api/me/export → eduvora-my-data-YYYY-MM-DD.json
// "Download my data" (Dashboard → My Profile). Only the logged-in student's
// OWN records — read with the server key but always filtered by their id.
// Other people's details (e.g. who they referred) are left out.
import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { getSession } from "@/lib/dashboard";
import { getAdminSupabase } from "@/lib/supabase/admin";

type Q = PromiseLike<{ data: unknown; error: { message: string } | null }>;
/** Runs a query; a table that isn't set up yet just gives an empty list. */
async function safe(q: Q) {
  const { data, error } = await q;
  return error ? [] : (data ?? []);
}

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const db = getAdminSupabase();
  if (!db) return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  const uid = s.user.id;
  const email = (s.profile?.email || s.user.email || "").toLowerCase();

  const [profile, purchases, bookings, attempts, predictions, reviews, enquiries, myReferral, referredByMe, rewards, credits, coupons, downloads] = await Promise.all([
    safe(db.from("profiles").select("*").eq("id", uid)),
    safe(db.from("purchases").select("id,amount,original_amount,coupon_code,coupon_discount,referral_discount,reward_used,status,invoice_number,razorpay_payment_id,payment_method,created_at,paid_at,refunded_at,products(title,category)").eq("user_id", uid).in("status", ["paid", "failed", "refunded"])),
    safe(db.from("bookings").select("id,name,phone,email,class_year,expected_marks,message,status,payment_status,amount,invoice_number,paid_at,created_at,slots(date,start_time,end_time)").eq("user_id", uid).not("status", "in", "(awaiting_payment,expired)")),
    safe(db.from("test_attempts").select("score,started_at,submitted_at,tests(title,total_marks)").eq("user_id", uid)),
    safe(db.from("predictions").select("marks,entered_rank,predicted_min_rank,predicted_max_rank,preferred_campus,preferred_branch,data_year,created_at").eq("user_id", uid)),
    safe(db.from("reviews").select("name,type,rating,comment,is_approved,created_at").eq("user_id", uid)),
    safe(email ? db.from("enquiries").select("name,phone,email,class_year,message,status,created_at").or(`user_id.eq.${uid},email.eq."${email.replace(/"/g, "")}"`) : db.from("enquiries").select("name,phone,email,class_year,message,status,created_at").eq("user_id", uid)),
    safe(db.from("referrals").select("status,referred_discount,created_at").eq("referred_id", uid)),
    safe(db.from("referrals").select("status,referrer_reward,created_at,rewarded_at").eq("referrer_id", uid)),
    safe(db.from("reward_ledger").select("amount,kind,note,created_at").eq("user_id", uid)),
    safe(db.from("session_credit_adjustments").select("delta,note,created_at").eq("user_id", uid)),
    safe(db.from("coupon_redemptions").select("discount,status,created_at,coupons(code)").eq("user_id", uid)),
    safe(db.from("file_downloads").select("file_name,action,watermarked,created_at").eq("user_id", uid)),
  ]);

  const now = new Date();
  const out = {
    about: `Your personal data held by ${siteConfig.businessName}, exported on ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(now)} IST. Times are in UTC. Questions or corrections: ${siteConfig.email}`,
    account: {
      id: uid,
      email: s.user.email ?? null,
      phone: s.user.phone || null,
      created_at: s.user.created_at,
      last_sign_in_at: s.user.last_sign_in_at ?? null,
      sign_in_methods: (s.user.app_metadata?.providers as string[] | undefined) ?? [],
    },
    profile: (profile as unknown[])[0] ?? null,
    purchases,
    counselling_bookings: bookings,
    test_results: attempts,
    rank_predictions: predictions,
    reviews,
    enquiries,
    referral: { joined_with_a_friends_link: myReferral, friends_you_invited: referredByMe },
    reward_credit_history: rewards,
    session_credit_adjustments: credits,
    coupons_used: coupons,
    file_downloads: downloads,
  };

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="eduvora-my-data-${day}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
