import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckIcon, HomeIcon } from "@/components/Icons";
import BackButton from "@/components/BackButton";
import LoginForm from "@/components/LoginForm";
import { siteConfig } from "@/config/site";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "Sign In / Sign Up",
  description: "Sign in or create your student account with your phone number or Google account.",
};

const benefits = [
  "Access your courses and recorded classes",
  "Take mock tests and track your scores",
  "Download your study material anytime",
  "See and manage your counselling bookings",
];

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <section className="hero-bg relative overflow-hidden px-4 py-10 sm:py-16">
      <div className="grid-pattern absolute inset-0" aria-hidden />
      <div className="relative mx-auto mb-6 max-w-5xl"><BackButton tone="dark" /></div>
      <div className="relative mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
        {/* Left: why create an account (desktop only) */}
        <div className="hidden animate-fade-up text-white lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent-300">Student account</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight">Everything for your VITEEE journey, in one place.</h1>
          <ul className="mt-8 space-y-4">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-slate-200">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-400/20 text-accent-300"><CheckIcon className="h-4 w-4" /></span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: the form */}
        <div className="mx-auto w-full max-w-md animate-fade-up rounded-[1.75rem] bg-white p-6 shadow-2xl sm:p-8">
          <div className="flex justify-center"><Logo size="lg" eager /></div>
          <h2 className="mt-5 text-center text-2xl font-extrabold text-slate-900">Welcome to {siteConfig.businessName} 👋</h2>
          <Suspense fallback={null}>
            <LoggedOutNotice searchParams={searchParams} />
          </Suspense>
          <div className="mt-5">
            <Suspense fallback={<LoginForm />}>
              <FormWithMode searchParams={searchParams} />
            </Suspense>
          </div>
          <Link href="/" className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700">
            <HomeIcon className="h-4 w-4" /> Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}

// /login?mode=signup opens the Sign Up tab
async function FormWithMode({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  return <LoginForm initialMode={sp.mode === "signup" ? "signup" : "signin"} />;
}

// Shown after clicking Logout (/login?loggedOut=1)
async function LoggedOutNotice({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  if (sp.loggedOut !== "1") return null;
  return (
    <p role="status" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
      <CheckIcon className="h-4 w-4" /> You have been logged out successfully.
    </p>
  );
}
