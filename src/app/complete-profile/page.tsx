import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CompleteProfileForm from "@/components/auth/CompleteProfileForm";
import Logo from "@/components/Logo";
import { communityHref, getCommunityLink } from "@/lib/community";
import { getSession } from "@/lib/dashboard";
import { localDigits, needsPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Complete your profile", robots: { index: false, follow: false } };

// After login / sign-up (email or Google): students and parents without a valid
// mobile number land here before anything else (src/proxy.ts), and can't skip it.
// Admins and counsellors never see it. After saving → back to the page they wanted.
export default function CompleteProfilePage({ searchParams }: PageProps<"/complete-profile">) {
  return (
    <section className="hero-bg relative min-h-[100svh] overflow-hidden px-4 py-10 sm:py-16">
      <div className="grid-pattern absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-md">
        <div className="mb-6 flex justify-center"><span className="rounded-2xl bg-white px-4 py-2"><Logo /></span></div>
        <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-[1.75rem] bg-white/90" />}>
          <Content searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
}

/** only our own pages ("/dashboard", "/courses/x?y") — never another site */
const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") && !n.startsWith("/complete-profile") ? n : "/dashboard");

async function Content({ searchParams }: { searchParams: PageProps<"/complete-profile">["searchParams"] }) {
  const next = safeNext((await searchParams).next);
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(`/complete-profile?next=${encodeURIComponent(next)}`)}`);
  if (!needsPhone(s.profile ?? { role: "student", phone: null })) redirect(next);

  const { data: extra } = await s.supabase.from("profiles").select("class_year").eq("id", s.user.id).maybeSingle(); // (column from supabase/phone-required.sql)
  const meta = s.user.user_metadata as { full_name?: string; name?: string } | undefined;
  const community = await getCommunityLink();
  return (
    <CompleteProfileForm
      next={next}
      fullName={s.profile?.full_name || meta?.full_name || meta?.name || ""}
      phone={localDigits(s.profile?.phone)}
      classYear={(extra?.class_year as string | null | undefined) ?? (s.profile?.role === "parent" ? "Parent" : "")}
      email={s.user.email ?? ""}
      communityHref={community ? communityHref("signup") : null}
    />
  );
}
