"use server";
// Saves a free enquiry into Supabase (table "enquiries").
// Anyone can send one; only admins can read them (see supabase/enquiries.sql).
import { notifyEnquiry } from "./email/notify";
import { getServerSupabase } from "./supabase/server";

export type EnquiryState = { ok: boolean; message: string } | null;

const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

export async function sendEnquiry(_prev: EnquiryState, form: FormData): Promise<EnquiryState> {
  // Hidden "website" field: real people never fill it, spam bots do.
  if (clean(form.get("website"), 100)) return { ok: true, message: "Thanks! We'll contact you soon." };

  const name = clean(form.get("name"), 80);
  const phone = clean(form.get("phone"), 16);
  const email = clean(form.get("email"), 120);
  const classYear = clean(form.get("class_year"), 40);
  const message = clean(form.get("message"), 1500);
  const source = form.get("source") === "unlock" ? "unlock" : "contact";

  if (name.length < 2) return { ok: false, message: "Please enter your name." };
  if (phone.replace(/\D/g, "").length < 10 || !/^[0-9+ ()-]{10,16}$/.test(phone)) return { ok: false, message: "Please enter a valid 10-digit phone number." };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: "Please enter a valid email (or leave it empty)." };

  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, message: "Enquiries are not available right now. Please try again later." };

  const id = crypto.randomUUID(); // so we can email the admin about this exact enquiry
  const { error } = await supabase.from("enquiries").insert({
    id,
    name,
    phone,
    email: email || null,
    class_year: classYear || null,
    message: message || null,
    source,
  });
  if (error) {
    console.warn("[enquiry] could not save:", error.message);
    const missing = error.code === "42P01" || error.code === "PGRST205";
    return { ok: false, message: missing ? "Enquiries are not set up yet (run supabase/enquiries.sql)." : "Sorry, something went wrong. Please try again." };
  }
  notifyEnquiry(id); // email to ADMIN_EMAIL (never blocks the form)
  return { ok: true, message: "Thank you! Your enquiry has been received. Our team will call you back soon." };
}
