// =====================================================================
//  STUDENT DASHBOARD DATA (server only)
//  Every query filters by the logged-in student's id, and Supabase's
//  security rules (RLS) double-check it — students only ever get their own data.
// =====================================================================
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { todayInIndia } from "./format";
import { getServerSupabase } from "./supabase/server";

export type Profile = { full_name: string | null; phone: string | null; email: string | null; role: "student" | "parent" | "counsellor" | "admin" };

export type Session = { supabase: SupabaseClient; user: User; profile: Profile | null };

// Who is logged in (looked up once per page request)
export const getSession = cache(async (): Promise<Session | null> => {
  // Private pages are always built fresh for the visitor (never pre-built),
  // so reading the clock / login cookies below is fine.
  await connection();
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("full_name,phone,email,role").eq("id", data.user.id).maybeSingle();
  return { supabase, user: data.user, profile: profile as Profile | null };
});

/** Use at the top of every dashboard page. Not logged in → sent to the login page. */
export async function requireUser(path: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(path)}`);
  return session;
}

export function displayName(s: Session) {
  return s.profile?.full_name || s.user.email?.split("@")[0] || "Student";
}

// ---------- Types for the dashboard lists ----------
export type TestInfo = { id: string; title: string; type: "mock" | "mcq"; duration_minutes: number; total_marks: number; is_active: boolean; is_free?: boolean };
export type PurchaseRow = {
  id: string;
  amount: number;
  status: "created" | "pending" | "paid" | "failed" | "abandoned" | "refunded";
  invoice_number: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  products: { id: string; title: string; slug: string; category: string; is_free?: boolean; file_path: string | null; tests: TestInfo[] } | null;
};
export type BookingRow = {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  payment_status: string;
  amount?: number | null;
  invoice_number?: string | null;
  meet_link?: string | null;
  created_at: string;
  slots: { date: string; start_time: string; end_time: string; price: number } | null;
};
export type AttemptRow = { id: string; test_id: string; score: number; submitted_at: string | null; tests: { title: string; total_marks: number } | null };

export async function getMyPurchases(s: Session): Promise<PurchaseRow[]> {
  const { data, error } = await s.supabase
    .from("purchases")
    .select("id,amount,status,invoice_number,razorpay_payment_id,created_at,products(id,title,slug,category,is_free,file_path,tests(id,title,type,duration_minutes,total_marks,is_active))")
    .eq("user_id", s.user.id)
    .order("created_at", { ascending: false });
  if (error) console.warn("getMyPurchases:", error.message);
  return (data ?? []) as unknown as PurchaseRow[];
}

export async function getMyBookings(s: Session): Promise<BookingRow[]> {
  const cols = "id,status,payment_status,amount,invoice_number,created_at,slots(date,start_time,end_time,price)";
  const load = (c: string) =>
    s.supabase
      .from("bookings")
      .select(c)
      .eq("user_id", s.user.id)
      .not("status", "in", "(awaiting_payment,expired)") // unpaid attempts are never shown
      .order("created_at", { ascending: false });
  let { data, error } = await load(`${cols},meet_link`);
  if (error?.code === "42703") ({ data, error } = await load(cols)); // google-calendar.sql not run yet
  if (error) console.warn("getMyBookings:", error.message);
  return (data ?? []) as unknown as BookingRow[];
}

export async function getMyAttempts(s: Session, limit = 50): Promise<AttemptRow[]> {
  const { data, error } = await s.supabase
    .from("test_attempts")
    .select("id,test_id,score,submitted_at,tests(title,total_marks)")
    .eq("user_id", s.user.id)
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) console.warn("getMyAttempts:", error.message);
  return (data ?? []) as unknown as AttemptRow[];
}

export async function getFreeTests(s: Session): Promise<TestInfo[]> {
  const { data, error } = await s.supabase
    .from("tests")
    .select("id,title,type,duration_minutes,total_marks,is_active,is_free")
    .eq("is_free", true)
    .eq("is_active", true)
    .order("created_at");
  if (error) console.warn("getFreeTests:", error.message);
  return (data ?? []) as TestInfo[];
}

/** Private class/video links — only returned by Supabase if the student paid. */
export async function getProductContent(s: Session, productId: string): Promise<{ title: string; url: string }[]> {
  const { data, error } = await s.supabase.rpc("get_product_content", { p_product_id: productId });
  if (error || !Array.isArray(data)) return [];
  return (data as unknown[])
    .map((item, i) =>
      typeof item === "string"
        ? { title: `Link ${i + 1}`, url: item }
        : { title: String((item as { title?: string }).title ?? `Link ${i + 1}`), url: String((item as { url?: string }).url ?? "") },
    )
    .filter((l) => /^https?:\/\//.test(l.url));
}

/** Next booking that is still coming up */
export function nextBooking(bookings: BookingRow[]) {
  const today = todayInIndia();
  return bookings
    .filter((b) => ["pending", "confirmed"].includes(b.status) && b.slots && b.slots.date >= today)
    .sort((a, b) => (a.slots!.date + a.slots!.start_time).localeCompare(b.slots!.date + b.slots!.start_time))[0];
}

export const paidOnly = (rows: PurchaseRow[]) => rows.filter((r) => r.status === "paid" && r.products);
