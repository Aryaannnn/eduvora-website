"use client";

import { useEffect, useState } from "react";
import { getOwned } from "@/lib/owned-client";
import { CheckIcon } from "./Icons";

/** "✓ Enrolled" — only for a logged-in student who owns this product (checked in the browser after the page loads). */
export default function EnrolledBadge({ productId, className = "" }: { productId: string; className?: string }) {
  const [owned, setOwned] = useState(false);
  useEffect(() => {
    let alive = true;
    getOwned().then((o) => alive && setOwned(o.owned.includes(productId)));
    return () => {
      alive = false;
    };
  }, [productId]);
  if (!owned) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white ${className}`}>
      <CheckIcon className="h-3.5 w-3.5" /> Enrolled
    </span>
  );
}
