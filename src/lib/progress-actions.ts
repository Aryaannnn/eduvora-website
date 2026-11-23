"use server";

// "Mark as done" on a PDF — saved with the student's OWN login, so the database
// (Row Level Security) only allows their own row, for a PDF they have access to.
import { getSession } from "./dashboard";

export async function setFileDone(fileId: string, done: boolean): Promise<{ ok: true; doneAt: string | null } | { ok: false; error: string }> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Please log in again." };
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return { ok: false, error: "File not found." };
  const { data, error } = await s.supabase
    .from("file_progress")
    .upsert({ user_id: s.user.id, file_id: fileId, done: !!done }, { onConflict: "user_id,file_id" })
    .select("done_at")
    .single();
  if (error) {
    if (/file_progress/.test(error.message) && /exist|schema cache/i.test(error.message)) return { ok: false, error: "Progress tracking isn't switched on yet." };
    if (/row-level security|violates/i.test(error.message)) return { ok: false, error: "You don't have access to this file." };
    return { ok: false, error: "Could not save. Please try again." };
  }
  return { ok: true, doneAt: (data?.done_at as string | null) ?? null };
}
