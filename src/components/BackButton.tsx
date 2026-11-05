"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "./Icons";
import { readNavDepth } from "./NavigationEffects";

// "← Back" — goes to the PREVIOUS page on this website.
// If there is none (e.g. the link was opened directly), it goes to the home page.
//   tone="dark"  → for navy/dark backgrounds (page title bands)
//   tone="light" → for white/light backgrounds (dashboards)
export default function BackButton({ tone = "light", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  const router = useRouter();

  function goBack() {
    if (readNavDepth() > 0 && window.history.length > 1) router.back();
    else router.push("/");
  }

  const styles =
    tone === "dark"
      ? "bg-white/10 text-white ring-white/25 hover:bg-accent-400 hover:text-brand-950 hover:ring-accent-400"
      : "bg-white text-brand-700 ring-slate-300 hover:bg-accent-400 hover:text-brand-950 hover:ring-accent-400";

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back to the previous page"
      className={`inline-flex min-h-9 items-center gap-1 rounded-full py-1.5 pl-2 pr-3.5 text-sm font-semibold ring-1 transition active:scale-95 ${styles} ${className}`}
    >
      <ChevronLeftIcon className="h-4 w-4" /> Back
    </button>
  );
}
