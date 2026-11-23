"use client";

import { useState } from "react";

// "PDFs" | "Study plan" inside a course in My Courses (only when the course has a plan).
export default function CourseTabs({ pdfs, plan, planDays }: { pdfs: React.ReactNode; plan: React.ReactNode | null; planDays: number }) {
  const [tab, setTab] = useState<"pdfs" | "plan">("pdfs");
  if (!plan) return <>{pdfs}</>;
  const btn = (k: "pdfs" | "plan", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === k}
      onClick={() => setTab(k)}
      className={`min-h-11 rounded-xl px-4 text-sm font-bold transition ${tab === k ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="mt-4">
      <div role="tablist" aria-label="Course sections" className="flex flex-wrap gap-2">
        {btn("pdfs", "📄 PDFs")}
        {btn("plan", `📅 Study plan (${planDays} days)`)}
      </div>
      <div className={tab === "pdfs" ? "" : "hidden"}>{pdfs}</div>
      <div className={tab === "plan" ? "" : "hidden"}>{plan}</div>
    </div>
  );
}
