import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import BuyButton, { SecurePaymentNote } from "../BuyButton";
import { ClipboardIcon, ClockIcon, FileIcon, TargetIcon } from "../Icons";

const style = {
  mock: { label: "Mock Test", icon: ClipboardIcon, chip: "bg-emerald-50 text-emerald-700", box: "bg-emerald-500" },
  mcq: { label: "MCQ Practice", icon: TargetIcon, chip: "bg-rose-50 text-rose-700", box: "bg-rose-500" },
  pyq: { label: "Previous Year Paper", icon: FileIcon, chip: "bg-amber-50 text-amber-800", box: "bg-amber-500" },
};

// Used for mock tests, MCQ packs and previous year papers
export default function TestCard({ product }: { product: Product }) {
  const d = product.details;
  const kind = product.category === "previous_paper" ? "pyq" : d.test_type === "mcq" ? "mcq" : "mock";
  const st = style[kind];
  const freeTest = product.is_free ? product.tests?.find((t) => t.is_free) : undefined;

  return (
    <article className="card card-hover flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl text-white ${st.box}`}><st.icon className="h-5 w-5" /></span>
        <div className="flex flex-wrap justify-end gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.chip}`}>{st.label}</span>
          {d.badge && <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">{d.badge}</span>}
        </div>
      </div>
      <h3 className="mt-4 font-bold text-slate-900">{product.title}</h3>
      {product.description && <p className="mt-1.5 text-sm text-slate-600">{product.description}</p>}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
        {d.questions_count && <span>{d.questions_count.toLocaleString("en-IN")} questions</span>}
        {d.duration_label && <span className="inline-flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" />{d.duration_label}</span>}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <div>
          <span className={`text-xl font-extrabold ${product.is_free ? "text-green-600" : "text-slate-900"}`}>{formatPrice(product.price)}</span>
          {product.original_price && <span className="ml-1.5 text-xs text-slate-400 line-through">{formatPrice(product.original_price)}</span>}
        </div>
        {freeTest ? (
          <Link href={`/tests/${freeTest.id}`} className="btn-accent !px-4 !py-2.5">Start Test</Link>
        ) : product.is_free && product.file_path ? (
          <a href={`/api/download/${product.id}`} className="btn-accent !px-4 !py-2.5">Download</a>
        ) : (
          <div className="shrink-0"><BuyButton productId={product.id} label={product.price > 0 ? "Buy" : "Get Free"} className="btn-primary !px-5 !py-2.5" trust={false} /></div>
        )}
      </div>
      {!product.is_free && product.price > 0 && <SecurePaymentNote className="mt-3 border-t border-slate-100 pt-3" />}
    </article>
  );
}
