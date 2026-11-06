"use server";

// =====================================================================
//  "Write a Review" (student dashboard)
//  • Only students who PAID for something (a product or a counselling
//    session) — checked here on the server AND by the database rules.
//  • Consent box required. Every new/edited review is HIDDEN until the
//    admin approves it (Admin → Reviews).
//  • Paid students get the "Verified Student" badge (set by the database).
// =====================================================================
import { getSession } from "./dashboard";

export type ReviewState = { ok: boolean; message: string } | null;

export async function hasPaidAnything(): Promise<boolean> {
  const s = await getSession();
  if (!s) return false;
  const { data, error } = await s.supabase.rpc("has_paid_anything");
  if (!error) return data === true;
  // before supabase/stats-reviews.sql is run: check directly
  const [p, b] = await Promise.all([
    s.supabase.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", s.user.id).eq("status", "paid").gt("amount", 0),
    s.supabase.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", s.user.id).eq("payment_status", "paid"),
  ]);
  return (p.count ?? 0) > 0 || (b.count ?? 0) > 0;
}

export async function submitMyReview(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const s = await getSession();
  if (!s) return { ok: false, message: "Please log in again." };
  if (!(await hasPaidAnything())) return { ok: false, message: "Reviews can be written after your first purchase or counselling session." };

  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const type = form.get("type") === "parent" ? "parent" : "student";
  const rating = Number(form.get("rating"));
  const comment = String(form.get("comment") ?? "").trim();
  const consent = form.get("consent") === "on";

  if (name.length < 2) return { ok: false, message: "Please enter the name to show with your review." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, message: "Please choose a rating from 1 to 5 stars." };
  if (comment.length < 20) return { ok: false, message: "Please write at least 20 characters about your experience." };
  if (comment.length > 1000) return { ok: false, message: "Please keep your review under 1000 characters." };
  if (!consent) return { ok: false, message: "Please tick the box to allow EDUVORA to show your review." };

  const row = { name, type, rating, comment, consent_given: true, consent_at: new Date().toISOString(), user_id: s.user.id };
  const { data: mine } = await s.supabase.from("reviews").select("id").eq("user_id", s.user.id).maybeSingle();
  const { error } = mine
    ? await s.supabase.from("reviews").update(row).eq("id", mine.id)
    : await s.supabase.from("reviews").insert(row);
  if (error) {
    console.warn("[review] save failed:", error.message);
    const setup = /user_id|consent_given|is_verified|schema cache/.test(error.message);
    return { ok: false, message: setup ? "Reviews are being set up — please try again later." : "Could not save your review. Please try again." };
  }
  return {
    ok: true,
    message: mine
      ? "Thank you! Your updated review was sent. It will appear on the website after we approve it."
      : "Thank you! Your review was sent. It will appear on the website after we approve it.",
  };
}
