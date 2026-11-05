// Admin-only data loaders (server). Supabase RLS lets admins read every row.
import type { Session } from "./dashboard";

export type AdminProfile = { id: string; full_name: string | null; email: string | null; phone: string | null; role: string; created_at: string };

/** Students' names/emails for a list of user ids (purchases & bookings point to auth users) */
export async function profilesById(s: Session, ids: string[]): Promise<Map<string, AdminProfile>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { data } = await s.supabase.from("profiles").select("id,full_name,email,phone,role,created_at").in("id", unique);
  return new Map(((data ?? []) as AdminProfile[]).map((p) => [p.id, p]));
}

export const personLabel = (p?: AdminProfile) => p?.full_name || p?.email || (p?.phone ? `+${p.phone}` : "Unknown user");
