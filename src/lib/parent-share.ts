// The student's own parent-link status (never the secret — only Supabase's
// fingerprint is stored, and it isn't read here).
import type { ShareState } from "@/components/dashboard/ParentShare";
import type { Session } from "./dashboard";

export async function getMyParentShare(s: Session): Promise<ShareState> {
  const { data, error } = await s.supabase
    .from("parent_shares")
    .select("parent_email,created_at,expires_at,revoked_at,view_count,last_viewed_at")
    .eq("user_id", s.user.id)
    .maybeSingle();
  if (error || !data) return { status: "none", expires_at: null, parent_email: null, view_count: 0, last_viewed_at: null, created_at: null };
  const status = data.revoked_at ? "off" : new Date(data.expires_at).getTime() <= new Date().getTime() ? "expired" : "active";
  return { status, expires_at: data.expires_at, parent_email: data.parent_email, view_count: data.view_count ?? 0, last_viewed_at: data.last_viewed_at, created_at: data.created_at };
}
