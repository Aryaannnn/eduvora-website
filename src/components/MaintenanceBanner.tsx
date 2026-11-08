// Small "Maintenance mode is ON" bar — only for admins/counsellors (everyone
// else sees the maintenance page instead, see src/proxy.ts).
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { getSession } from "@/lib/dashboard";
import { getPublicSupabase } from "@/lib/supabase/public";

async function maintenanceOn(): Promise<boolean> {
  "use cache";
  cacheTag("maintenance");
  cacheLife({ stale: 15, revalidate: 15, expire: 300 });
  const db = getPublicSupabase();
  if (!db) return false;
  const { data, error } = await db.from("maintenance_settings").select("enabled").eq("id", 1).maybeSingle();
  return !error && !!data?.enabled;
}

export default async function MaintenanceBanner() {
  if (!(await maintenanceOn())) return null;
  const s = await getSession();
  const role = s?.profile?.role;
  if (role !== "admin" && role !== "counsellor") return null;
  return (
    <div role="status" className="sticky top-0 z-[60] bg-amber-400 px-4 py-1.5 text-center text-sm font-bold text-amber-950 print:hidden">
      🛠️ Maintenance mode is ON — visitors and students see the maintenance page.{" "}
      {role === "admin" && <Link href="/admin/settings#maintenance" className="underline">Turn it off</Link>}
    </div>
  );
}
