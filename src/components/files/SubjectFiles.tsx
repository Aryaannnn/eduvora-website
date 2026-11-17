import { formatBytes, PDF_SUBJECTS, subjectLabel } from "@/lib/product-files";
import PdfButtons from "./PdfButtons";

export type SubjectFile = {
  id: string;
  product_id: string;
  display_name: string;
  file_type: "pdf" | "zip";
  size_bytes: number;
  sort_order: number;
  subject?: string | null;
  chapter?: string | null;
};

// Files of a crash course / the Question Bank, in sections: Physics · Chemistry ·
// Mathematics (· Other for PDFs without a subject). Each PDF: Open PDF + Download
// (/api/files/<id> → access checked, the student's personal watermarked copy).
export default function SubjectFiles({ files, title = "", empty, open = true }: { files?: SubjectFile[]; title?: string; empty?: string; open?: boolean }) {
  if (!files?.length) return empty ? <p className="mt-3 text-sm text-slate-500">{empty}</p> : null;
  const groups = [...PDF_SUBJECTS.map((s) => s.id as string), ""]
    .map((id) => ({ id, label: id ? subjectLabel(id) : "Other", files: files.filter((f) => (f.subject ?? "") === id || (!id && !PDF_SUBJECTS.some((s) => s.id === f.subject))) }))
    .filter((g) => g.files.length > 0);
  const only = groups.length === 1 && !groups[0].id; // nothing has a subject → a plain list
  return (
    <div className="mt-3 space-y-2">
      {groups.map((g) => (
        <details key={g.id || "other"} open={open} className="group rounded-2xl bg-white ring-1 ring-slate-200">
          {!only && (
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 font-bold text-slate-900 hover:bg-slate-50">
              <span>
                {g.label} <span className="ml-1 text-xs font-semibold text-slate-500">{g.files.length} PDF{g.files.length === 1 ? "" : "s"}</span>
              </span>
              <span className="text-slate-400 transition group-open:rotate-180" aria-hidden>▾</span>
            </summary>
          )}
          <ul className={`space-y-2 ${only ? "p-2" : "px-2 pb-2"}`} aria-label={`${g.label} PDFs${title ? ` in ${title}` : ""}`}>
            {g.files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500 text-[11px] font-extrabold text-white">PDF</span>
                <div className="min-w-0 flex-1">
                  {f.chapter && <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">{f.chapter}</p>}
                  <p className="truncate font-semibold text-slate-900">{f.display_name}</p>
                  <p className="text-xs text-slate-500">PDF · watermarked with your name · {formatBytes(Number(f.size_bytes))}</p>
                </div>
                <PdfButtons fileId={f.id} name={f.display_name} />
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
