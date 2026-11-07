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
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="bg-slate-50">
      <div className="container-page flex flex-col gap-6 pb-16 pt-6 sm:pt-8 lg:flex-row lg:gap-8">
        <AdminIdleGuard />
        <Suspense fallback={<AdminNav role="counsellor" />}>
          <NavForRole />
        </Suspense>
        <div className="min-w-0 flex-1">
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
