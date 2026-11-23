import { getSession } from "@/lib/dashboard";
import { materialSince } from "@/lib/progress";
import { subjectLabel } from "@/lib/product-files";
import BellMenu, { type BellItem } from "./BellMenu";

// Dashboard bell: grouped "new material" updates for the courses this student
// can open (Row Level Security does the filtering), newest first, last 30 days.
export default async function NotificationBell() {
  const s = await getSession();
  if (!s) return null;
  const [{ data, error }, { data: reads }] = await Promise.all([
    s.supabase.from("material_updates").select("id,product_id,subject,file_count,last_at,products(title)").gte("last_at", materialSince(30)).order("last_at", { ascending: false }).limit(20),
    s.supabase.from("material_update_reads").select("update_id").eq("user_id", s.user.id).limit(500),
  ]);
  if (error) return null; // supabase/material-updates.sql not run yet
  const read = new Set((reads ?? []).map((r) => r.update_id as string));
  const items: BellItem[] = (data ?? []).map((u) => {
    const title = (u.products as unknown as { title?: string } | null)?.title ?? "your course";
    const n = Number(u.file_count) || 1;
    return {
      id: u.id as string,
      text: `${n} new PDF${n === 1 ? "" : "s"} added to ${title}${u.subject ? ` · ${subjectLabel(u.subject as string)}` : ""}`,
      at: u.last_at as string,
      href: `/dashboard/courses?open=${u.product_id}${u.subject ? `&subject=${u.subject}` : ""}#item-${u.product_id}`,
      unread: !read.has(u.id as string),
    };
  });
  return <BellMenu items={items} />;
}
