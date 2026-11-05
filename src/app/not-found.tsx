import Link from "next/link";
import BackButton from "@/components/BackButton";

export default function NotFound() {
  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <div className="mb-6 flex justify-center"><BackButton /></div>
        <p className="text-6xl font-extrabold text-brand-600">404</p>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Page not found</h1>
        <p className="mt-2 text-slate-600">The page you are looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="btn-primary">Go to Home</Link>
          <Link href="/courses" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50">View Courses</Link>
        </div>
      </div>
    </section>
  );
}
