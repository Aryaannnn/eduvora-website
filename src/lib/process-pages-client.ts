// Admin browser: turn a PDF's pages into WebP pictures for the fast reader.
// Calls the server a few pages at a time (no time-outs on big PDFs) and reports
// progress. Used by Admin → Products → Files and "Process all PDFs".
export type PagesProgress = { done: number; total: number };

export async function processPdfPages(fileId: string, onProgress?: (p: PagesProgress) => void): Promise<{ pages: number; bytes: number }> {
  let from = 1;
  for (let round = 0; round < 500; round++) {
    const res = await fetch(`/api/admin/files/${fileId}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ from }),
    }).catch(() => null);
    if (!res) throw new Error("Could not reach the server. Please check your internet and try Re-process.");
    const d = (await res.json().catch(() => ({}))) as { error?: string; pageCount?: number; done?: number; finished?: boolean; nextFrom?: number; bytes?: number };
    if (!res.ok) throw new Error(d.error ?? `Preparing the pages failed (${res.status}).`);
    onProgress?.({ done: d.done ?? 0, total: d.pageCount ?? 0 });
    if (d.finished) return { pages: d.pageCount ?? 0, bytes: d.bytes ?? 0 };
    from = d.nextFrom ?? from + 1;
  }
  throw new Error("Preparing the pages took too long. Please try Re-process.");
}
