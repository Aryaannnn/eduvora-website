"use server";

// The bell: mark material updates as read (own rows only — Row Level Security).
import { getSession } from "./dashboard";

export async function markUpdatesRead(updateIds: string[]): Promise<{ ok: boolean }> {
  const s = await getSession();
  if (!s) return { ok: false };
  const ids = updateIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  if (!ids.length) return { ok: true };
  const { error } = await s.supabase
    .from("material_update_reads")
    .upsert(ids.map((update_id) => ({ user_id: s.user.id, update_id })), { onConflict: "user_id,update_id", ignoreDuplicates: true });
  return { ok: !error };
}
