import type { Metadata } from "next";
import { Suspense } from "react";
import PaymentsManager, { type AdminPayment } from "@/components/admin/PaymentsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";
import { sweepStalePayments } from "@/lib/payments-server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { personLabel, profilesById } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

// Paid, failed and refunded payments (refund columns only exist after supabase/refunds.sql)
async function loadMain(s: Awaited<ReturnType<typeof requireAdmin>>) {
  const cols = "id,user_id,amount,status,invoice_number,razorpay_order_id,razorpay_payment_id,created_at,products(title),failure_reason";
  const full = await s.supabase.from("purchases").select(`${cols},refunded_at,refund_note`).in("status", ["paid", "failed", "refunded"]).order("created_at", { ascending: false }).limit(5000);
  if (!full.error || !/refund/.test(full.error.message)) return full;
  return s.supabase.from("purchases").select(cols).in("status", ["paid", "failed"]).order("created_at", { ascending: false }).limit(5000);
}

async function Content() {
  const s = await requireAdmin("/admin/payments");
  // Automatic check first: hidden attempts older than 30 min → ask Razorpay →
  // paid (item unlocked) / failed / abandoned (stays hidden)
  const db = getAdminSupabase();
  if (db) await sweepStalePayments(db, { limit: 25 }).catch((e) => console.warn("[payments] cleanup failed:", e));
  const cols = "id,user_id,amount,status,invoice_number,razorpay_order_id,razorpay_payment_id,created_at,products(title)";
  const [purchases, hidden, users, products] = await Promise.all([
    // Only real outcomes in the main list
    loadMain(s),
    // Unfinished attempts — only for the collapsed support section
    s.supabase.from("purchases").select(cols).in("status", ["created", "pending", "abandoned"]).order("created_at", { ascending: false }).limit(300),
    s.supabase.from("profiles").select("id,full_name,email,phone").order("full_name").limit(5000),
    s.supabase.from("products").select("id,title,price").order("title"),
  ]);
  if (purchases.error) return <p className="card p-6 text-red-600">Could not load payments: {purchases.error.message}</p>;

  type Raw = Omit<AdminPayment, "student" | "email" | "product"> & { products: { title: string } | null };
  const rows = (purchases.data ?? []) as unknown as Raw[];
  const hiddenRows = (hidden.data ?? []) as unknown as Raw[];
  const people = await profilesById(s, [...rows, ...hiddenRows].map((r) => r.user_id));
  const toPayment = (r: Raw): AdminPayment => ({
    ...r,
    product: r.products?.title ?? "Product",
    student: personLabel(people.get(r.user_id)),
    email: people.get(r.user_id)?.email ?? "",
  });
  const payments = rows.map(toPayment);
  const attempts = hiddenRows.map(toPayment);

  return (
    <PaymentsManager
      payments={payments}
      attempts={attempts}
      users={(users.data ?? []).map((u) => ({ id: u.id as string, label: `${u.full_name || "No name"} — ${u.email || (u.phone ? `+${u.phone}` : "")}` }))}
      products={(products.data ?? []) as { id: string; title: string; price: number }[]}
    />
  );
}
