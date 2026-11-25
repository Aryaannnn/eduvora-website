"use client";

// Which products the logged-in student owns (one request per page, shared by
// every Buy button and "Enrolled" badge on the page).
import { hasLoginCookie } from "./supabase/lazy";

export type Owned = { loggedIn: boolean; owned: string[] };
let ownedPromise: Promise<Owned> | null = null;

export function getOwned() {
  // Visitors who aren't logged in have no Supabase login cookie → nothing can be owned,
  // so no request at all (saves a server call on every page with a Buy button)
  if (!hasLoginCookie()) return Promise.resolve<Owned>({ loggedIn: false, owned: [] });
  ownedPromise ??= fetch("/api/payments/owned", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { loggedIn: false, owned: [] }))
    .catch(() => ({ loggedIn: false, owned: [] }));
  return ownedPromise;
}

/** Dashboard → My Courses & Material, with this item opened and highlighted */
export const myCoursesHref = (productId: string) => `/dashboard/courses?open=${productId}#item-${productId}`;

/** After a purchase / unlock: ask again next time */
export function resetOwned() {
  ownedPromise = null;
}
