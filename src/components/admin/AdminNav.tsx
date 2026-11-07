"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLogout } from "@/lib/useLogout";
import { Spinner } from "../BuyButton";
import Logo from "../Logo";
import { BookIcon, ChatIcon, CalendarIcon, ChartIcon, ClipboardIcon, ClockIcon, GiftIcon, GridIcon, LogoutIcon, MailIcon, ReceiptIcon, ShieldIcon, StarIcon, TagIcon, TargetIcon, UsersIcon } from "../Icons";

const links = [
  { href: "/admin", label: "Overview", icon: ChartIcon },
  { href: "/admin/products", label: "Products", icon: BookIcon },
  { href: "/admin/packages", label: "Packages", icon: StarIcon },
  { href: "/admin/slots", label: "Slots", icon: ClockIcon },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarIcon },
  { href: "/admin/enquiries", label: "Enquiries", icon: MailIcon },
  { href: "/admin/important-dates", label: "Important Dates", icon: CalendarIcon },
  { href: "/admin/blog", label: "Blog", icon: BookIcon },
  { href: "/admin/tests", label: "Tests", icon: ClipboardIcon },
  { href: "/admin/predictor", label: "Predictor", icon: TargetIcon },
  { href: "/admin/reviews", label: "Reviews", icon: StarIcon },
  { href: "/admin/feedback", label: "Feedback", icon: ChatIcon },
  { href: "/admin/students", label: "Students", icon: UsersIcon },
  { href: "/admin/payments", label: "Payments", icon: ReceiptIcon },
  { href: "/admin/coupons", label: "Coupons", icon: TagIcon },
  { href: "/admin/referrals", label: "Referrals", icon: GiftIcon },
  { href: "/admin/emails", label: "Email Logs", icon: MailIcon },
  { href: "/admin/activity", label: "Activity Log", icon: ShieldIcon },
  { href: "/admin/settings", label: "Settings", icon: GridIcon },
];

export default function AdminNav() {
  const pathname = usePathname();
  const { logout, loggingOut } = useLogout();
  const active = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <nav aria-label="Admin" className="sticky top-24 rounded-[1.25rem] bg-slate-900 p-3 text-slate-300 shadow-xl">
          <div className="mb-3 flex justify-center rounded-xl bg-white p-2"><Logo size="sidebar" /></div>
          <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-accent-300">Admin panel</p>
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active(l.href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active(l.href) ? "bg-white text-slate-900" : "hover:bg-white/10 hover:text-white"}`}
                >
                  <l.icon className="h-5 w-5" /> {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
            <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-white/10 hover:text-white">
              <GridIcon /> Student view
            </Link>
            <button type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:cursor-wait disabled:opacity-70">
              {loggingOut ? <><Spinner /> Logging out…</> : <><LogoutIcon /> Logout</>}
            </button>
          </div>
        </nav>
      </aside>

      {/* Phone / tablet: scrollable tab bar */}
      <nav aria-label="Admin" className="-mx-4 mb-4 overflow-x-auto px-4 lg:hidden">
        <ul className="flex w-max gap-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active(l.href) ? "page" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ring-1 ${active(l.href) ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200"}`}
              >
                <l.icon className="h-4 w-4" /> {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
