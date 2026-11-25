// =====================================================================
//  CONTACT MODE — Admin → Settings → "Contact mode" (supabase/contact-mode.sql)
//   "open"    → the number is shown to everyone with Call + WhatsApp
//   "private" → only paid students and admins see it (Help page, booking
//               confirmation, payment success); everyone else gets the
//               free enquiry form
//  Only the mode and the two texts come from the database. The number itself
//  is CONTACT_PHONE on the server (src/lib/contact.ts).
//  Until contact-mode.sql is run: Open mode with the default texts.
// =====================================================================
import { cacheLife, cacheTag } from "next/cache";
import { siteConfig } from "@/config/site";
import { getPublicSupabase } from "./supabase/public";

export type ContactModeName = "open" | "private";
export type ContactMode = { mode: ContactModeName; openNote: string; privateNote: string; ready: boolean };

const DEFAULTS: ContactMode = { mode: "open", openNote: siteConfig.contactTexts.openNote, privateNote: siteConfig.contactTexts.privateNote, ready: false };

/** Cached; refreshed straight away when the admin saves (updateTag("contact-mode")). */
export async function getContactMode(): Promise<ContactMode> {
  "use cache";
  cacheTag("contact-mode");
  const db = getPublicSupabase();
  if (!db) return (cacheLife("minutes"), DEFAULTS);
  const { data, error } = await db.from("contact_settings").select("mode,open_note,private_note").eq("id", 1).maybeSingle();
  if (error || !data) {
    cacheLife("minutes"); // failed → try again within 5 minutes (sooner after an admin save)
    return DEFAULTS;
  }
  cacheLife("hours");
  return {
    mode: data.mode === "private" ? "private" : "open",
    openNote: (data.open_note as string) || DEFAULTS.openNote,
    privateNote: (data.private_note as string) || DEFAULTS.privateNote,
    ready: true,
  };
}
