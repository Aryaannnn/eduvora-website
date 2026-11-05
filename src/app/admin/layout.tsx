import type { Metadata } from "next";
import AdminNav from "@/components/admin/AdminNav";
import BackButton from "@/components/BackButton";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false },
};

// Every /admin page checks role = 'admin' on the server (see src/lib/admin.ts)
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="bg-slate-50">
      <div className="container-page flex flex-col gap-6 pb-16 pt-6 sm:pt-8 lg:flex-row lg:gap-8">
        <AdminNav />
        <div className="min-w-0 flex-1">
          <div className="mb-4"><BackButton /></div>
          {children}
        </div>
      </div>
    </div>
  );
}
