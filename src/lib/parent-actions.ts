"use server";

// =====================================================================
//  "SHARE WITH PARENT" (student dashboard)
//  • createParentLink(): makes a long random secret (32 bytes), stores
//    ONLY its SHA-256 fingerprint in Supabase (parent_share_create), and
//    returns the link ONCE. 90 days; making a new one turns the old one off.
//  • Optional email to the parent (max 3 per day, so it can't be abused).
//  • revokeParentLink(): turns it off.
// =====================================================================
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { siteConfig } from "@/config/site";
import { getSession } from "./dashboard";
import { button, esc, layout, note } from "./email/layout";
import { sendAndLog } from "./email/send";
import { formatDate } from "./format";
import { getAdminSupabase } from "./supabase/admin";

type Result = { ok: true; url: string; expiresAt: string; emailed: boolean; message: string } | { ok: false; error: string };

const MAX_EMAILS_PER_DAY = 3;

export async function createParentLink(parentEmail: string, sendEmail: boolean): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Please log in again." };
  const email = parentEmail.trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Please enter a valid email address for your parent (or leave it empty)." };
  if (sendEmail && !email) return { ok: false, error: "Please enter your parent's email to send the link." };
  if (email && email === (s.user.email ?? "").toLowerCase()) return { ok: false, error: "That's your own email — please enter your parent's email." };

  // Email limit (checked BEFORE making a new link)
  const db = getAdminSupabase();
  if (sendEmail && db) {
    const { count } = await db
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "parent_link")
      .eq("ref_id", s.user.id)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString());
    if ((count ?? 0) >= MAX_EMAILS_PER_DAY) return { ok: false, error: `You can email the link at most ${MAX_EMAILS_PER_DAY} times a day. Copy the link and share it instead.` };
  }

  const token = randomBytes(32).toString("base64url"); // 43 characters, ~256 bits
  const hash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await s.supabase.rpc("parent_share_create", { p_token_hash: hash, p_parent_email: email || null });
  if (error) {
    console.warn("[parent] create failed:", error.message);
    return { ok: false, error: /function|schema cache/i.test(error.message) ? "Parent sharing is being set up — please try again later." : "Could not create the link. Please try again." };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { expires_at: string };
  const url = `${siteConfig.siteUrl}/parent/${token}`;
  revalidatePath("/dashboard");

  let emailed = false;
  if (sendEmail && email) {
    const name = s.profile?.full_name || "Your child";
    const first = name.split(" ")[0];
    emailed = await sendAndLog("parent_link", s.user.id, {
      to: email,
      subject: `${first} shared their VITEEE progress with you`,
      html: layout({
        preheader: `See ${first}'s counselling sessions, test scores and predicted rank.`,
        title: `${esc(first)}'s progress on ${esc(siteConfig.businessName)}`,
        body: `<p>Hello,</p>
<p><strong>${esc(name)}</strong> has shared a private, read-only view of their VITEEE preparation with you: counselling sessions, courses, mock test scores and their latest predicted rank.</p>
<p>${button("View progress", url)}</p>
${note(`🔒 This link is private — please don't share it. It works until <strong>${esc(formatDate(row.expires_at.slice(0, 10)))}</strong> and ${esc(first)} can turn it off at any time. No login is needed.`, "navy")}
<p style="font-size:13px;color:#64748b">You received this email because ${esc(first)} entered your address on ${esc(siteConfig.businessName)}. If this wasn't expected, you can ignore it.</p>`,
      }),
    });
  }
  return {
    ok: true,
    url,
    expiresAt: row.expires_at,
    emailed,
    message: sendEmail ? (emailed ? `Link created and emailed to ${email}.` : "Link created, but the email could not be sent — copy the link and share it instead.") : "Link created.",
  };
}

export async function revokeParentLink(): Promise<{ ok: boolean; error?: string }> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Please log in again." };
  const { error } = await s.supabase.rpc("parent_share_revoke");
  revalidatePath("/dashboard");
  return error ? { ok: false, error: "Could not turn it off. Please try again." } : { ok: true };
}
