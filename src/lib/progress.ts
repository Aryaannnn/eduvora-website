// Course progress (supabase/course-progress.sql) — server helpers.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FileProgress = { done: boolean; done_at: string | null; last_opened_at: string | null };
export type ProgressMap = Record<string, FileProgress>;

/** The logged-in student's own progress for these PDFs (Row Level Security: own rows only). null before the SQL is run. */
export async function loadMyProgress(supabase: SupabaseClient, fileIds: string[]): Promise<ProgressMap | null> {
  if (!fileIds.length) return {};
  const out: ProgressMap = {};
  for (let i = 0; i < fileIds.length; i += 300) {
    const { data, error } = await supabase.from("file_progress").select("file_id,done,done_at,last_opened_at").in("file_id", fileIds.slice(i, i + 300));
    if (error) return null;
    for (const r of data ?? []) out[r.file_id as string] = { done: !!r.done, done_at: (r.done_at as string) ?? null, last_opened_at: (r.last_opened_at as string) ?? null };
  }
  return out;
}

/** "Continue where you left off": remember the last PDF opened (server key; never changes "done"). */
export async function recordOpened(db: SupabaseClient, userId: string, fileId: string) {
  await db
    .from("file_progress")
    .upsert({ user_id: userId, file_id: fileId, last_opened_at: new Date().toISOString() }, { onConflict: "user_id,file_id" })
    .then(() => null, () => null);
}

export const NEW_DAYS = 7;

/** PDFs that are "New" for this student: added in the last 7 days and not opened since. */
export function newFileIds(files: { id: string; added_at?: string | null }[], progress: ProgressMap | null): string[] {
  const since = Date.now() - NEW_DAYS * 86_400_000;
  return files
    .filter((f) => {
      if (!f.added_at) return false;
      const added = new Date(f.added_at).getTime();
      if (added < since) return false;
      const opened = progress?.[f.id]?.last_opened_at;
      return !opened || new Date(opened).getTime() < added;
    })
    .map((f) => f.id);
}

/** ISO time `days` ago (bell: updates of the last 30 days) */
export const materialSince = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** done / total for a list of PDFs */
export function countDone(fileIds: string[], progress: ProgressMap) {
  const done = fileIds.filter((id) => progress[id]?.done).length;
  return { done, total: fileIds.length, pct: fileIds.length ? Math.round((done / fileIds.length) * 100) : 0 };
}
