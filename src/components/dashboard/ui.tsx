import Link from "next/link";

// Small building blocks shared by the dashboard pages

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyBox({ text, href, cta }: { text: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
      <p className="text-slate-500">{text}</p>
      {href && cta && <Link href={href} className="btn-primary mt-4">{cta}</Link>}
    </div>
  );
}

const statusColors: Record<string, string> = {
  abandoned: "bg-slate-100 text-slate-500",
  paid: "bg-green-100 text-green-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-slate-100 text-slate-700",
  pending: "bg-amber-100 text-amber-800",
  unpaid: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-sky-100 text-sky-700",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusColors[status] ?? "bg-slate-100 text-slate-700"}`}>{status}</span>;
}

export function DashSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-slate-200" />)}
      </div>
      <div className="h-48 rounded-2xl bg-slate-200" />
    </div>
  );
}
