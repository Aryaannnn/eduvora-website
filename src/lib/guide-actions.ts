"use server";
// The free guide popup → saves the request, adds the person to Admin → Leads
// ("Free guide"), emails the download link and returns it for the page.
// Spam limits: hidden bot field, max 5 requests per hour from one device/network,
// and the guide is emailed to the same address at most once a day.
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { notifyFreeGuide } from "./email/notify";
import { getGuideOffer } from "./growth";
import { GUIDE_CLASSES } from "./guide-shared";
import { getAdminSupabase } from "./supabase/admin";

export type GuideResult = { ok: true; downloadUrl: string; emailed: boolean } | { ok: false; error: string };

const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

export async function requestFreeGuide(form: FormData): Promise<GuideResult> {
  if (clean(form.get("website"), 100)) return { ok: false, error: "Please try again." }; // bot trap

  const name = clean(form.get("name"), 80);
  const email = clean(form.get("email"), 120).toLowerCase();
  const phoneDigits = clean(form.get("phone"), 20).replace(/\D/g, "");
  const phone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "";
  const classYear = clean(form.get("class_year"), 40);
  const consent = form.get("consent") === "on";

  if (name.length < 2) return { ok: false, error: "Please enter your name." };
  if (!email && !phone) return { ok: false, error: "Please enter your email or phone number." };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (phoneDigits && !/^[6-9]\d{9}$/.test(phone)) return { ok: false, error: "Please enter a valid 10-digit mobile number." };
  if (classYear && !(GUIDE_CLASSES as readonly string[]).includes(classYear)) return { ok: false, error: "Please choose your class." };
  if (!consent) return { ok: false, error: "Please tick the box so we can send you the guide." };

  const offer = await getGuideOffer();
  if (!offer) return { ok: false, error: "The free guide isn't available right now. Please try again later." };
  const db = getAdminSupabase();
  if (!db) return { ok: false, error: "Please try again later." };

  // Spam limit per device/network (the IP is scrambled — we never store it)
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim();
  const ipHash = ip ? createHash("sha256").update(`${ip}|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? "eduvora"}`).digest("hex").slice(0, 32) : null;
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  if (ipHash) {
    const { count } = await db.from("guide_requests").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", hourAgo);
    if ((count ?? 0) >= 5) return { ok: false, error: "Too many requests. Please try again in an hour." };
  }

  // Emailed this address in the last 24 hours? Don't email again (but still give the download)
  let emailAgain = !!email;
  if (email) {
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db.from("guide_requests").select("id", { count: "exact", head: true }).eq("email", email).not("emailed_at", "is", null).gte("created_at", dayAgo);
    if ((count ?? 0) > 0) emailAgain = false;
  }

  const { data: row, error } = await db
    .from("guide_requests")
    .insert({ product_id: offer.productId, name, email: email || null, phone: phone || null, class_year: classYear || null, consent_at: new Date().toISOString(), ip_hash: ipHash })
    .select("id")
    .single();
  if (error || !row) {
    console.warn("[guide] could not save:", error?.message);
    return { ok: false, error: /guide_requests/.test(error?.message ?? "") ? "The free guide isn't set up yet." : "Sorry, something went wrong. Please try again." };
  }
  const id = row.id as string;
  await db.rpc("capture_guide_lead", { p_name: name, p_email: email || null, p_phone: phone || null, p_class: classYear || null }).then(() => null, () => null);
  if (emailAgain) notifyFreeGuide(id); // in the background — never slows the popup
  return { ok: true, downloadUrl: `/api/guide/${id}`, emailed: emailAgain };
}
