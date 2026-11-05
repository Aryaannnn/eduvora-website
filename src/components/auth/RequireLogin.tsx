// Server-side login check for pages that have no private data of their own.
// Not logged in → straight to /login (and back here after signing in).
import { requireUser } from "@/lib/dashboard";

export default async function RequireLogin({ path }: { path: string }) {
  await requireUser(path);
  return null;
}
