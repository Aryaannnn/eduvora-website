import type { Metadata } from "next";
import BackButton from "@/components/BackButton";
import DashboardNav from "@/components/dashboard/DashboardNav";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Dashboard" },
  robots: { index: false }, // private pages — keep them out of Google
};

// Shared frame for every /dashboard page: sidebar (desktop) + bottom menu (phone).
// Desktop: a FIXED 260px sidebar column and a separate scrolling content area
// (with space kept for the scrollbar), so neither can ever push the other.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="bg-slate-50">
      <div className="dash-shell container-page pb-28 pt-6 sm:pt-8 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8 lg:pb-0 lg:pt-0">
        <DashboardNav />
        <div id="dashboard-content" className="dash-content min-w-0">
          <div className="mb-4 print:hidden"><BackButton /></div>
          {children}
        </div>
      </div>
    </div>
  );
}
