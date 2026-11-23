// "Your access ends in 7 days" email — once per purchase, only while
// siteConfig.emailsEnabled is on (the dashboard banner shows it either way).
import "server-only";
import { siteConfig } from "@/config/site";
import { getAdminSupabase } from "../supabase/admin";
import { button, esc, layout, url } from "./layout";
import { sendAndLog } from "./send";

export async function sendAccessReminders(): Promise<{ sent: number; note?: string }> {
  if (!siteConfig.emailsEnabled) return { sent: 0, note: "emails are switched off (siteConfig.emailsEnabled)" };
  const db = getAdminSupabase();
  if (!db) return { sent: 0 };
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86_400_000);
  const { data, error } = await db
    .from("purchases")
    .select("id,user_id,product_id,access_until,products(title)")
    .eq("status", "paid")
    .is("access_reminder_sent_at", null)
    .gt("access_until", now.toISOString())
    .lte("access_until", in7.toISOString())
    .limit(200);
  if (error) return { sent: 0, note: "run supabase/access-periods.sql" };
  let sent = 0;
  for (const p of data ?? []) {
    // claim first, so it is sent once even if two jobs run at the same time
    const { data: claimed } = await db.from("purchases").update({ access_reminder_sent_at: now.toISOString() }).eq("id", p.id).is("access_reminder_sent_at", null).select("id");
    if (!claimed?.length) continue;
    const { data: prof } = await db.from("profiles").select("full_name,email").eq("id", p.user_id).maybeSingle();
    if (!prof?.email) continue;
    const title = (p.products as unknown as { title?: string } | null)?.title ?? "your course";
    const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(p.access_until as string));
    const ok = await sendAndLog("access_ending", p.id as string, {
      to: prof.email as string,
      subject: `Your access to ${title} ends on ${date}`,
      html: layout({
        preheader: `Your access to ${title} ends on ${date}.`,
        title: "Your access ends soon ⏳",
        body: `<p>Hi ${esc(String(prof.full_name ?? "").split(" ")[0] || "there")},</p>
<p>Your access to <strong>${esc(title)}</strong> ends on <strong>${esc(date)}</strong>. After that, the PDFs can't be opened or downloaded any more.</p>
<p>${button("Open My Courses", url(`/dashboard/courses?open=${p.product_id}#item-${p.product_id}`))}</p>
<p style="font-size:13px;color:#64748b">Need more time? Reply to this email or contact us from the Help page.</p>`,
      }),
    }).catch(() => false);
    if (ok) sent++;
  }
  return { sent };
}
