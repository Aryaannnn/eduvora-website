import type { Metadata } from "next";
import { Suspense } from "react";
import AdminIdleGuard from "@/components/admin/AdminIdleGuard";
import AdminNav from "@/components/admin/AdminNav";
import BackButton from "@/components/BackButton";
import { getSession } from "@/lib/dashboard";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false },
};

// Every /admin page checks the role + a 2-step (authenticator app) login on the
// server (see src/lib/admin.ts). Counsellors only see (and can only open) their pages.
// Inactive for 2 hours → logged out (AdminIdleGuard + src/proxy.ts).
//
// Desktop: two separate columns that can never push each other —
//   • the sidebar: a FIXED 260px column with its own scrolling
//   • the content: its own scroll area with space kept for the scrollbar
//     (so the page never jumps sideways when a scrollbar appears)
// Phones / tablets: the normal page flow with the scrollable tab bar on top.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="bg-slate-50">
      <div className="dash-shell container-page pb-16 pt-6 sm:pt-8 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8 lg:pb-0 lg:pt-0">
        <AdminIdleGuard />
        <Suspense fallback={<AdminNav role="counsellor" />}>
          <NavForRole />
        </Suspense>
        <div id="admin-content" className="dash-content min-w-0">
          <div className="mb-4"><BackButton /></div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** The menu for this person's role (the pages themselves check the role again). */
async function NavForRole() {
  const s = await getSession();
  return <AdminNav role={s?.profile?.role === "admin" ? "admin" : "counsellor"} />;
}
