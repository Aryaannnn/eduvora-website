import BackButton from "./BackButton";
import Logo from "./Logo";

// Navy page with a white EDUVORA card — used by Forgot Password and Set New Password
export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="hero-bg relative min-h-[75vh] overflow-hidden px-4 py-8 sm:py-14">
      <div className="grid-pattern absolute inset-0" aria-hidden />
      <div className="relative mx-auto mb-6 max-w-md"><BackButton tone="dark" /></div>
      <div className="relative mx-auto w-full max-w-md animate-fade-up rounded-[1.75rem] bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex justify-center"><Logo size="lg" eager /></div>
        <h1 className="mt-5 text-center text-2xl font-extrabold text-brand-700">{title}</h1>
        {subtitle && <p className="mt-1 text-center text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}
