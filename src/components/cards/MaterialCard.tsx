import { discountPercent, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import BuyButton from "../BuyButton";
import { BookIcon, CheckIcon } from "../Icons";

export default function MaterialCard({ m }: { m: Product }) {
  const d = m.details;
  const off = discountPercent(m.price, m.original_price);
  return (
    <article className="card card-hover flex h-full flex-col overflow-hidden">
      <div className={`relative bg-gradient-to-br ${d.color ?? "from-brand-600 to-brand-500"} p-5 text-white`}>
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15" aria-hidden />
        <div className="relative flex items-start justify-between">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/20"><BookIcon className="h-5 w-5" /></span>
          {d.badge && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-900">{d.badge}</span>}
        </div>
        <p className="relative mt-4 text-xl font-extrabold">{m.college ?? m.title}</p>
        {d.format && <p className="relative text-xs font-medium text-white/80">{d.format}</p>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-bold text-slate-900">{m.title}</h3>
        {m.description && <p className="mt-1.5 text-sm text-slate-600">{m.description}</p>}
        {d.contents && (
          <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
            {d.contents.map((c) => (
              <li key={c} className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />{c}</li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{formatPrice(m.price)}</span>
            {m.original_price && <span className="text-sm text-slate-400 line-through">{formatPrice(m.original_price)}</span>}
            {off > 0 && <span className="text-xs font-bold text-green-600">{off}% off</span>}
          </div>
          {m.is_free && m.file_path ? (
            <a href={`/api/download/${m.id}`} className="btn-accent mt-4 w-full">Download Free</a>
          ) : (
            <div className="mt-4"><BuyButton productId={m.id} label={m.price > 0 ? "Buy Now" : "Get it Free"} className="btn-primary w-full" trust={m.price > 0} /></div>
          )}
        </div>
      </div>
    </article>
  );
}
