"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LockIcon } from "../Icons";

// One shared check per page view: does this visitor have predictor access?
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

/** Small lock icon next to "Rank Predictor" links — hidden for students who have access. */
export default function PredictorLockBadge({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <Suspense fallback={<Lock className={className} />}>
      <Badge className={className} />
    </Suspense>
  );
}

function Badge({ className }: { className: string }) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let alive = true;
    checkAccess(pathname).then((ok) => alive && setAllowed(ok));
    return () => {
      alive = false;
    };
  }, [pathname]);

  return allowed ? null : <Lock className={className} />;
}

function Lock({ className }: { className: string }) {
  return (
    <span className="inline-flex align-middle" title="Unlocks with paid counselling">
      <LockIcon className={className} />
      <span className="sr-only"> (locked — unlocks with counselling)</span>
    </span>
  );
}
