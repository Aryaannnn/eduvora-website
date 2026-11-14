"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Logo from "../Logo";
import { useLogout } from "@/lib/useLogout";
import { Spinner } from "../Spinner";
import { BookIcon, CalendarIcon, ClipboardIcon, CloseIcon, DotsIcon, GiftIcon, GridIcon, HeadsetIcon, LogoutIcon, ReceiptIcon, StarIcon, TargetIcon, UserIcon, ChartIcon, UsersIcon } from "../Icons";
import PredictorLockBadge from "../predictor/PredictorLockBadge";

export const dashboardLinks = [
  { href: "/dashboard", label: "Home", icon: GridIcon },
  { href: "/dashboard/courses", label: "My Courses & Material", short: "Courses", icon: BookIcon },
  { href: "/dashboard/tests", label: "My Tests", short: "Tests", icon: ClipboardIcon },
  { href: "/dashboard/progress", label: "My Progress", short: "Progress", icon: ChartIcon },
  { href: "/dashboard/predictor", label: "Rank & College Predictor", short: "Predictor", icon: TargetIcon },
  { href: "/dashboard/bookings", label: "My Bookings", short: "Bookings", icon: CalendarIcon },
  { href: "/dashboard/payments", label: "Payment History", icon: ReceiptIcon },
  { href: "/dashboard/profile", label: "My Profile", icon: UserIcon },
  { href: "/dashboard/refer", label: "Refer & Earn", icon: GiftIcon },
  { href: "/dashboard/parent", label: "Share with Parent", short: "Parent", icon: UsersIcon },
  { href: "/dashboard/review", label: "Write a Review", icon: StarIcon },
  { href: "/dashboard/help", label: "Help", icon: HeadsetIcon },
];
// Shown in the phone bottom bar; the rest go under "More"
const bottomHrefs = ["/dashboard", "/dashboard/courses", "/dashboard/tests", "/dashboard/bookings"];

// (Logout lives in src/lib/useLogout.ts — shared by every Logout button)

export default function DashboardNav() {
  const pathname = usePathname();
  const { logout, loggingOut } = useLogout();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
  const moreLinks = dashboardLinks.filter((l) => !bottomHrefs.includes(l.href));
  const moreActive = moreLinks.some((l) => isActive(l.href));

  return (
    <>
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="hidden w-64 shrink-0 lg:block print:hidden">
        <nav aria-label="Dashboard" className="card sticky top-24 p-3">
          <div className="flex justify-center border-b border-slate-100 px-3 pb-3 pt-1"><Logo size="sidebar" /></div>
          <p className="px-3 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-slate-400">Student dashboard</p>
          <ul className="space-y-1">
            {dashboardLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isActive(l.href) ? "bg-brand-600 text-white shadow-md shadow-brand-600/25" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <l.icon className="h-5 w-5" /> {l.label}{l.href === "/dashboard/predictor" && <PredictorLockBadge className="ml-auto" />}
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="mt-3 flex w-full items-center gap-3 rounded-xl border-t border-slate-100 px-3 pb-2 pt-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70"
          >
            {loggingOut ? <><Spinner /> Logging out…</> : <><LogoutIcon /> Logout</>}
          </button>
        </nav>
      </aside>

      {/* ---------- Phone bottom menu ---------- */}
      <nav aria-label="Dashboard" className="print:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {dashboardLinks
            .filter((l) => bottomHrefs.includes(l.href))
            .map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${isActive(l.href) ? "text-brand-700" : "text-slate-500"}`}
                >
                  <span className={`grid h-8 w-12 place-items-center rounded-full transition ${isActive(l.href) ? "bg-brand-100" : ""}`}>
                    <l.icon className="h-5 w-5" />
                  </span>
                  {l.short ?? l.label}
                </Link>
              </li>
            ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={`flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${moreActive ? "text-brand-700" : "text-slate-500"}`}
            >
              <span className={`grid h-8 w-12 place-items-center rounded-full ${moreActive ? "bg-brand-100" : ""}`}><DotsIcon /></span>
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* ---------- "More" sheet (phone) ---------- */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More options">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-fade-up rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="font-extrabold text-slate-900">More</p>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <ul className="mt-3 space-y-1" onClick={() => setMoreOpen(false)}>
              {moreLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={`flex items-center gap-3 rounded-xl px-3 py-3.5 font-semibold ${isActive(l.href) ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100"}`}>
                    <l.icon /> {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void logout(); }}
                  disabled={loggingOut}
                  aria-busy={loggingOut}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 font-semibold text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70"
                >
                  {loggingOut ? <><Spinner /> Logging out…</> : <><LogoutIcon /> Logout</>}
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
