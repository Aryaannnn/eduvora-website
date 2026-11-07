// =====================================================================
//  ACCOUNT DELETION (server only) — used by the student ("Delete my
//  account") and by admins (Admin → Students).
//   1. delete_account_data() in Supabase (supabase/privacy.sql):
//      predictions, test attempts, enquiries, reviews deleted; bookings and
//      purchases KEPT for tax but anonymised ("Deleted user", no link).
//   2. The login itself is deleted (also removes the profile, credits,
//      referrals, coupon uses).
//   3. A confirmation email is sent to the old address.
// =====================================================================
import "server-only";
import { siteConfig } from "@/config/site";
import { esc, layout } from "./email/layout";
import { sendAndLog } from "./email/send";
import { deleteEventsQuietly } from "./google-calendar";
import { getAdminSupabase } from "./supabase/admin";

export async function deleteAccount(userId: string, requestedBy: "student" | "admin", adminId?: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const db = getAdminSupabase();
  if (!db) return { ok: false, error: "Account deletion is not available right now. Please email us." };

  // Remember where to send the confirmation before the details are gone
  const { data: p } = await db.from("profiles").select("full_name,email,phone,role").eq("id", userId).maybeSingle();
  const { data: authUser } = await db.auth.admin.getUserById(userId);
  const email = (p?.email as string | null) || authUser?.user?.email || "";
  const name = ((p?.full_name as string | null) || "").split(" ")[0] || "there";
  if (p?.role === "admin") return { ok: false, error: "Admin accounts can't be deleted. Remove the admin role first." };

  // CRM: their lead (matched by account, email or phone) and your notes about them
  const phone10 = String(p?.phone ?? authUser?.user?.phone ?? "").replace(/\D/g, "").slice(-10);
  await db.from("leads").delete().eq("user_id", userId);
  if (email) await db.from("leads").delete().eq("email", email.toLowerCase());
  if (phone10.length === 10) await db.from("leads").delete().eq("phone", phone10);

  // Reviews published from their session feedback (not linked to the account) → delete too
  const { data: pub } = await db.from("session_feedback").select("review_id").eq("user_id", userId).not("review_id", "is", null);
  const pubIds = (pub ?? []).map((r) => r.review_id as string);
  if (pubIds.length) await db.from("reviews").delete().in("id", pubIds);

  // Their calendar events contain name/phone → remove them after the data is deleted
  const { data: evs } = await db.from("bookings").select("calendar_event_id").eq("user_id", userId).not("calendar_event_id", "is", null);
  const eventIds = (evs ?? []).map((e) => e.calendar_event_id as string);

  const { error: e1 } = await db.rpc("delete_account_data", { p_user: userId, p_requested_by: requestedBy, p_admin: adminId ?? null });
  if (e1) {
    console.warn("[account] delete data failed:", e1.message);
    return { ok: false, error: /delete_account_data|function/i.test(e1.message) ? "Account deletion is being set up (run supabase/privacy.sql). Please try again later." : "Could not delete the account. Please try again." };
  }
  await deleteEventsQuietly(eventIds);
  const { error: e2 } = await db.auth.admin.deleteUser(userId);
  if (e2) {
    console.warn("[account] delete login failed:", e2.message);
    return { ok: false, error: "Your data was removed, but the login could not be deleted. Please email us and we'll finish it." };
  }

  if (email) {
    const support = siteConfig.email;
    await sendAndLog("account_deleted", null, {
      to: email,
      subject: `Your ${siteConfig.businessName} account has been deleted`,
      html: layout({
        preheader: "Your account and personal data have been deleted.",
        title: "Account deleted",
        body: `<p>Hi ${esc(name)},</p>
<p>As ${requestedBy === "admin" ? "requested" : "you asked"}, your ${esc(siteConfig.businessName)} account has been <strong>deleted</strong>.</p>
<ul style="padding-left:20px;margin:12px 0">
<li>Deleted: your profile, rank predictions, test results, enquiries and reviews.</li>
<li>Kept without your name, email or phone: payment and invoice records, which the law requires us to keep for tax purposes.</li>
</ul>
<p>If you did not ask for this, reply to this email or write to <a href="mailto:${esc(support)}">${esc(support)}</a> straight away.</p>
<p>You are always welcome back. 🙂</p>`,
      }),
    }).catch(() => false);
    // don't keep the old address in the email log either
    await db.from("email_logs").update({ to_email: "deleted-account" }).eq("kind", "account_deleted").eq("to_email", email);
  }
  return { ok: true, name };
}
