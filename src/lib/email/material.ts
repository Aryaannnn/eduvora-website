// "New material added to your course" — at most ONE email per course per day to
// the students enrolled in it (paid / free unlock). Run by the cron job.
// Nothing is sent while siteConfig.emailsEnabled is false (updates are then just
// marked as handled, so turning emails on later doesn't send a backlog).
import "server-only";
import { siteConfig } from "@/config/site";
import { subjectLabel } from "../product-files";
import { getAdminSupabase } from "../supabase/admin";
import { button, esc, layout, url } from "./layout";
import { sendAndLog } from "./send";

const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const groupDone = () => new Date(Date.now() - 10 * 60_000).toISOString(); // uploads within 10 minutes are one group

export async function sendMaterialEmails(): Promise<{ courses: number; emails: number; note?: string }> {
  const db = getAdminSupabase();
  if (!db) return { courses: 0, emails: 0 };
  const { data: pending, error } = await db
    .from("material_updates")
    .select("id,product_id,subject,file_count,products(title,slug)")
    .is("emailed_at", null)
    .lt("last_at", groupDone())
    .limit(500);
  if (error) return { courses: 0, emails: 0, note: "run supabase/material-updates.sql" };
  if (!pending?.length) return { courses: 0, emails: 0 };

  const markDone = (ids: string[]) => db.from("material_updates").update({ emailed_at: new Date().toISOString() }).in("id", ids);
  if (!siteConfig.emailsEnabled) {
    await markDone(pending.map((p) => p.id as string));
    return { courses: 0, emails: 0, note: "emails are switched off (siteConfig.emailsEnabled)" };
  }

  const byProduct = new Map<string, typeof pending>();
  for (const u of pending) byProduct.set(u.product_id as string, [...(byProduct.get(u.product_id as string) ?? []), u]);
  let courses = 0;
  let emails = 0;
  for (const [productId, updates] of byProduct) {
    // one email per course per day: the first run today claims it; later updates wait for tomorrow
    const { data: claimed } = await db.from("material_emails").insert({ product_id: productId, day: todayIST() }).select("product_id");
    if (!claimed?.length) continue;
    courses++;
    const title = (updates[0].products as unknown as { title?: string } | null)?.title ?? "your course";
    const lines = updates.map((u) => `${Number(u.file_count) || 1} new PDF${Number(u.file_count) === 1 ? "" : "s"}${u.subject ? ` in ${subjectLabel(u.subject as string)}` : ""}`);
    const { data: buyers } = await db.from("purchases").select("user_id").eq("product_id", productId).eq("status", "paid").limit(5000);
    const ids = [...new Set((buyers ?? []).map((b) => b.user_id as string).filter(Boolean))];
    for (let i = 0; i < ids.length; i += 200) {
      const { data: people } = await db.from("profiles").select("id,full_name,email").in("id", ids.slice(i, i + 200));
      for (const p of people ?? []) {
        if (!p.email) continue;
        const first = String(p.full_name ?? "").split(" ")[0] || "there";
        const ok = await sendAndLog(`new_material`, productId, {
          to: p.email as string,
          subject: `New material added to your course — ${title}`,
          html: layout({
            preheader: `${lines.join(", ")} added to ${title}.`,
            title: "New material added to your course 📘",
            body: `<p>Hi ${esc(first)},</p>
<p>We've added new study material to <strong>${esc(title)}</strong>:</p>
<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<p>${button("Open My Courses", url(`/dashboard/courses?open=${productId}#item-${productId}`))}</p>
<p style="font-size:13px;color:#64748b">Your PDFs are personal copies, watermarked with your name. You get at most one of these emails per course per day.</p>`,
          }),
        }).catch(() => false);
        if (ok) emails++;
      }
    }
    await db.from("material_emails").update({ sent: emails }).eq("product_id", productId).eq("day", todayIST());
    await markDone(updates.map((u) => u.id as string));
  }
  return { courses, emails };
}
