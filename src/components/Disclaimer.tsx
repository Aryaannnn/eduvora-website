import { siteConfig } from "@/config/site";
import { ShieldIcon } from "./Icons";

// The "not affiliated with VIT" notice. ✏️ Text: src/config/site.ts → disclaimer
export default function Disclaimer({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <p
      role="note"
      className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-xs leading-relaxed ${
        tone === "dark" ? "bg-white/5 text-slate-400 ring-1 ring-white/10" : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
      } ${className}`}
    >
      <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span><strong className="font-semibold">Disclaimer:</strong> {siteConfig.disclaimer}</span>
    </p>
  );
}
