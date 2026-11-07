"use server";

// =====================================================================
//  POST-SESSION FEEDBACK (the student's own login)
//  Saved with the student's own session, so Supabase checks it again:
//  only their own booking, only once it is 'completed' (supabase/feedback.sql).
//  Sending it again updates the same feedback.
// =====================================================================
import { revalidatePath } from "next/cache";
import { getSession } from "./dashboard";

export type FeedbackState = { ok: boolean; message: string } | null;

export async function submitFeedback(_prev: FeedbackState, form: FormData): Promise<FeedbackState> {
  const s = await getSession();
  if (!s) return { ok: false, message: "Please log in again." };

  const bookingId = String(form.get("booking_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return { ok: false, message: "Session not found." };
  const rating = Number(form.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, message: "Please choose a rating from 1 to 5 stars." };
  const helped = String(form.get("helped_most") ?? "").trim();
  const improve = String(form.get("improve") ?? "").trim();
  if (helped.length > 1000 || improve.length > 1000) return { ok: false, message: "Please keep each answer under 1000 characters." };
  const allowPublic = form.get("allow_public") === "on";
  if (allowPublic && helped.length < 10) return { ok: false, message: "To show your feedback as a review, please write a few words in \"What helped you most?\"." };

  const { data: b } = await s.supabase.from("bookings").select("id,status").eq("id", bookingId).eq("user_id", s.user.id).maybeSingle();
  if (!b) return { ok: false, message: "Session not found." };
  if (b.status !== "completed") return { ok: false, message: "You can give feedback once your session is over." };

  const row = { rating, helped_most: helped || null, improve: improve || null, allow_public: allowPublic };
  const { data: mine } = await s.supabase.from("session_feedback").select("id").eq("booking_id", bookingId).maybeSingle();
  const { error } = mine
    ? await s.supabase.from("session_feedback").update(row).eq("id", mine.id)
    : await s.supabase.from("session_feedback").insert({ ...row, booking_id: bookingId, user_id: s.user.id });
  if (error) {
    console.warn("[feedback] save failed:", error.message);
    const setup = /session_feedback|schema cache|does not exist/.test(error.message);
    return { ok: false, message: setup ? "Feedback is being set up — please try again later." : "Could not save your feedback. Please try again." };
  }
  revalidatePath("/dashboard/bookings");
  return { ok: true, message: mine ? "Thank you! Your feedback was updated." : "Thank you for your feedback! 🙏 It helps us guide the next student better." };
}
