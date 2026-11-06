"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// One shared check per page view: does this visitor have FULL predictor access?
let last: { path: string; promise: Promise<boolean> } | null = null;
function checkAccess(path: string) {
  if (!last || last.path !== path) {
    last = {
      path,
      promise: fetch("/api/predictor/access", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { allowed: false }))
        .then((d: { allowed?: boolean }) => d.allowed === true)
        .catch(() => false),
    };
  }
  return last.promise;
}

/**
 * Small "Free" pill next to "Rank Predictor" links: the rank part is free for
 * everyone. Hidden for students who already have the full college list
 * (paid counselling) — they don't need the hint.
 * (The file keeps its old name so existing imports keep working.)
 */
export default function PredictorLockBadge({ className = "" }: { className?: string }) {
  return (
    <Suspense fallback={<Free className={className} />}>
      <Badge className={className} />
    </Suspense>
  );
}

function Badge({ className }: { className: string }) {
  const pathname = usePathname();
  const [full, setFull] = useState(false);

  useEffect(() => {
    let alive = true;
    checkAccess(pathname).then((ok) => alive && setFull(ok));
    return () => {
      alive = false;
    };
  }, [pathname]);

  return full ? null : <Free className={className} />;
}

function Free({ className }: { className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-px align-middle text-[10px] font-extrabold uppercase leading-4 tracking-wide text-emerald-700 ring-1 ring-emerald-200 ${className}`}
      title="Rank prediction is free — the full college list comes with counselling"
    >
      Free
    </span>
  );
}
