import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AdminTwoFactor from "@/components/admin/AdminTwoFactor";
import { hasAdmin2fa } from "@/lib/admin";
import { requireUser } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Admin 2-step verification", robots: { index: false } };

// /admin-verify?next=/admin/...  — every admin must pass the authenticator-app
// check before opening /admin. First time: QR code setup. Later: 6-digit code.
export default function AdminVerifyPage(props: PageProps<"/admin-verify">) {
  return (
    <section className="hero-bg relative min-h-[70vh] overflow-hidden px-4 py-12 sm:py-16">
      <div className="grid-pattern absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-md">
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <Content searchParams={props.searchParams} />
        </Suspense>
      </div>
    </section>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin-verify">["searchParams"] }) {
  const sp = await searchParams;
  const raw = typeof sp.next === "string" ? sp.next : "/admin";
  const next = raw.startsWith("/admin") && !raw.startsWith("//") ? raw : "/admin";
  const s = await requireUser(`/admin-verify?next=${encodeURIComponent(next)}`);
  if (s.profile?.role !== "admin") redirect("/dashboard");
  if (await hasAdmin2fa(s)) redirect(next);
  return <AdminTwoFactor next={next} email={s.user.email ?? ""} />;
}
