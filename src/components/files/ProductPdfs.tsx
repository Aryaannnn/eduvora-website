import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { getSession } from "@/lib/dashboard";
import { formatBytes } from "@/lib/product-files";
import Link from "next/link";
import { BookIcon, FileIcon } from "../Icons";
import PdfButtons from "./PdfButtons";

// The PDFs of ONE product for the logged-in student — only if they have access
// (Row Level Security returns files of paid or free products only).
// Shown on course pages and the payment success page. ZIP files are never offered.
export default function ProductPdfs({ productId, className = "" }: { productId: string; className?: string }) {
  return (
    <Suspense fallback={null}>
      <Files productId={productId} className={className} />
    </Suspense>
  );
}

async function Files({ productId, className }: { productId: string; className: string }) {
  const s = await getSession();
  if (!s) return null;
  const { data } = await s.supabase
    .from("product_files")
    .select("id,display_name,size_bytes")
    .eq("product_id", productId)
    .eq("file_type", "pdf")
    .order("sort_order")
    .order("created_at");
  const files = (data ?? []) as { id: string; display_name: string; size_bytes: number }[];
  if (files.length === 0) return null;
  return (
    <section className={`card p-5 sm:p-6 ${className}`} aria-labelledby={`pdfs-${productId}`}>
      <h2 id={`pdfs-${productId}`} className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><FileIcon className="h-5 w-5 text-brand-600" /> Your files</h2>
      <p className="mt-1 text-sm text-slate-600">
        {siteConfig.inWebsiteReader ? "Read online in your dashboard." : "Each PDF is your personal copy, watermarked with your name. For personal use only — please don't share it."}
      </p>
      <ul className="mt-4 space-y-2">
        {files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-900">{f.display_name}</span>
              <span className="text-xs text-slate-500">PDF · {formatBytes(Number(f.size_bytes))}</span>
            </span>
            {siteConfig.inWebsiteReader ? (
              <Link href={`/dashboard/read/${f.id}`} className="btn-primary !px-4 !py-2 text-sm"><BookIcon className="h-4 w-4" /> Read</Link>
            ) : (
              <PdfButtons fileId={f.id} name={f.display_name} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
