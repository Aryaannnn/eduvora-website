import Link from "next/link";
import { ArrowRightIcon } from "./Icons";

// Shorter home page on phones: only the first 3 items of a section are shown,
// then a "View all" button. Computers and tablets still see every item.
export const MOBILE_LIMIT = 3;

/** Class for item number i (0-based): hidden on phones from the 4th item. `bp` = where the grid becomes 1 column. */
export const hideOnPhone = (i: number, bp: "sm" | "md" = "sm") => (i < MOBILE_LIMIT ? "" : bp === "md" ? "max-md:hidden" : "max-sm:hidden");

/** "View all (8) →" — only on phones, only when some items were hidden. */
export default function MobileViewAll({ total, href, label, bp = "sm" }: { total: number; href: string; label: string; bp?: "sm" | "md" }) {
  if (total <= MOBILE_LIMIT) return null;
  return (
    <div className={`mt-6 ${bp === "md" ? "md:hidden" : "sm:hidden"}`}>
      <Link href={href} className="btn-light w-full !py-3">
        {label} ({total}) <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}
