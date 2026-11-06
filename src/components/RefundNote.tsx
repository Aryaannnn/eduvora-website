import Link from "next/link";
import { siteConfig } from "@/config/site";
import { ReceiptIcon } from "./Icons";

// Short refund rule shown next to payment buttons.
// ✏️ Text: src/config/site.ts → refunds.digitalNote / refunds.counsellingNote
export default function RefundNote({ kind, className = "" }: { kind: "digital" | "counselling"; className?: string }) {
  const text = kind === "counselling" ? siteConfig.refunds.counsellingNote : siteConfig.refunds.digitalNote;
  return (
    <p className={`flex items-start justify-center gap-1.5 text-center text-[11px] leading-snug text-slate-500 ${className}`}>
      <ReceiptIcon className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span>
        {text}{" "}
        <Link href="/refund-policy" className="whitespace-nowrap font-semibold text-brand-700 underline">Refund policy</Link>
      </span>
    </p>
  );
}
