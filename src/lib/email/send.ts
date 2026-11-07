// =====================================================================
//  SENDING EMAIL (Resend) — SERVER ONLY
//  • Never throws: an email problem can never break a payment or booking.
//  • Every email is written to the "email_logs" table (sent / failed), and
//    failed ones can be resent from Admin → Email Logs.
//  Keys: RESEND_API_KEY and ADMIN_EMAIL in .env.local (never NEXT_PUBLIC_).
//  ✏️ Sender address: src/config/site.ts → emailSender.from
// =====================================================================
import "server-only";
import { after } from "next/server";
import { siteConfig } from "@/config/site";
import { getAdminSupabase } from "../supabase/admin";
import { reportFailure } from "../monitor";

export type Attachment = { filename: string; content: Uint8Array };
export type Email = { to: string; subject: string; html: string; attachments?: Attachment[] };

export const adminEmail = () => (process.env.ADMIN_EMAIL ?? "").trim();

/** Send through Resend's API. Returns Resend's id or an error message. */
async function deliver(mail: Email): Promise<{ id: string | null; error: string | null }> {
  const key = process.env.RESEND_API_KEY ?? "";
  if (!key) return { id: null, error: "RESEND_API_KEY is missing in .env.local" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.to)) return { id: null, error: `Invalid recipient address: "${mail.to}"` };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: siteConfig.emailSender.from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        ...(siteConfig.emailSender.replyTo ? { reply_to: siteConfig.emailSender.replyTo } : {}),
        ...(mail.attachments?.length
          ? { attachments: mail.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) }
          : {}),
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) return { id: null, error: `${res.status} ${body.name ?? ""}: ${body.message ?? "Resend refused the email"}`.trim() };
    return { id: body.id ?? null, error: null };
  } catch (e) {
    return { id: null, error: (e as Error).name === "AbortError" ? "Timed out talking to Resend" : (e as Error).message };
  }
}

/**
 * Send + log. `kind` and `refId` are saved so the admin can resend it later
 * (the email is rebuilt fresh from the database).
 */
export async function sendAndLog(kind: string, refId: string | null, mail: Email, logId?: string): Promise<boolean> {
  const res = await deliver(mail);
  const db = getAdminSupabase();
  if (db) {
    const row = {
      kind,
      ref_id: refId,
      to_email: mail.to,
      subject: mail.subject.slice(0, 300),
      status: res.error ? "failed" : "sent",
      error: res.error?.slice(0, 1000) ?? null,
      resend_id: res.id,
      updated_at: new Date().toISOString(),
    };
    let error: { message: string } | null = null;
    if (logId) {
      // "Resend" from the admin page → update the same log row and count the attempt
      const { data: cur } = await db.from("email_logs").select("attempts").eq("id", logId).maybeSingle();
      ({ error } = await db.from("email_logs").update({ ...row, attempts: Number(cur?.attempts ?? 1) + 1 }).eq("id", logId));
    } else {
      ({ error } = await db.from("email_logs").insert(row));
    }
    if (error) console.warn("[email] could not write the email log (run supabase/emails-invoices.sql?):", error.message);
  }
  if (res.error) reportFailure("email", `Email "${kind}" could not be sent`, res.error); // (address is never sent to Sentry)
  return !res.error;
}

/** Run email work after the response is sent (never blocks or breaks the request). */
export function inBackground(task: () => Promise<unknown>) {
  const safe = () => task().catch((e) => reportFailure("email", "Background email task failed", e));
  try {
    after(safe);
  } catch {
    void safe(); // outside a request (e.g. inside another after())
  }
}
