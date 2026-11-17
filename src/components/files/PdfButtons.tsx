import { DownloadIcon, ExternalIcon } from "../Icons";

// "View PDF" (new browser tab, the browser's own viewer) + "Download".
// Both go to /api/files/<id>, which checks access every time and sends the
// student's PERSONAL WATERMARKED copy (never the original).
export default function PdfButtons({ fileId, name, size = "md" }: { fileId: string; name: string; size?: "md" | "sm" }) {
  const pad = size === "sm" ? "!px-3 !py-2 text-xs" : "!px-4 !py-2 text-sm";
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/api/files/${fileId}?mode=open`} target="_blank" rel="noopener noreferrer" className={`btn-primary ${pad}`} aria-label={`View ${name} (PDF) in a new tab`}>
        <ExternalIcon className="h-4 w-4" /> View PDF
      </a>
      <a href={`/api/files/${fileId}?mode=download`} className={`btn-light ${pad}`} aria-label={`Download ${name} (PDF)`}>
        <DownloadIcon className="h-4 w-4" /> Download
      </a>
    </div>
  );
}
