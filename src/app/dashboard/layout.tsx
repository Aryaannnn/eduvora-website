import type { Metadata } from "next";
import BackButton from "@/components/BackButton";
import DashboardNav from "@/components/dashboard/DashboardNav";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Dashboard" },
  robots: { index: false }, // private pages — keep them out of Google
};

// Shared frame for every /dashboard page: sidebar (desktop) + bottom menu (phone)
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="bg-slate-50">
      <div className="container-page flex gap-8 pb-28 pt-6 sm:pt-8 lg:pb-14">
        <DashboardNav />
        <div className="min-w-0 flex-1">
          <div className="mb-4 print:hidden"><BackButton /></div>
          {children}
        </div>
      </div>
    </div>
  );
}
