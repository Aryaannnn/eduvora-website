import type { Metadata } from "next";
import { Suspense } from "react";
import MyDataPanel from "@/components/dashboard/MyDataPanel";
import ProfileForm from "@/components/dashboard/ProfileForm";
import { DashSkeleton, PageHeader, Panel } from "@/components/dashboard/ui";
import { initials } from "@/lib/format";
import { displayName, requireUser } from "@/lib/dashboard";

export const metadata: Metadata = { title: "My Profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const s = await requireUser("/dashboard/profile");
  const name = displayName(s);
  const phone = (s.profile?.phone ?? "").replace(/^\+?91(?=\d{10}$)/, "");
  // consent date (column from supabase/privacy.sql — missing before it is run)
  const { data: c } = await s.supabase.from("profiles").select("consent_at").eq("id", s.user.id).maybeSingle();

  return (
    <>
      <PageHeader title="My Profile" subtitle="Keep your details up to date so we can reach you." />
      <div className="grid gap-6 xl:grid-cols-[18rem_1fr]">
        <Panel className="flex flex-col items-center text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-2xl font-extrabold text-white">{initials(name)}</span>
          <p className="mt-3 text-lg font-extrabold text-slate-900">{name}</p>
          <p className="break-all text-sm text-slate-500">{s.user.email}</p>
          <span className="mt-3 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold capitalize text-brand-700">{s.profile?.role ?? "student"}</span>
        </Panel>
        <Panel title="Edit details">
          <ProfileForm userId={s.user.id} email={s.user.email ?? ""} fullName={s.profile?.full_name ?? ""} phone={phone} />
        </Panel>
      </div>
      <div className="mt-6"><MyDataPanel isAdmin={s.profile?.role === "admin" || s.profile?.role === "counsellor"} consentAt={(c?.consent_at as string | null | undefined) ?? null} /></div>
    </>
  );
}
