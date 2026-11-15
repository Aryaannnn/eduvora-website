// =====================================================================
//  SLOT BOARD (SERVER ONLY) — every upcoming 30-minute slot, free or booked,
//  for the slot picker on the home page and the Book a Slot page.
//  Comes from slot_board() in supabase/voice-calls.sql: only times and prices,
//  never who booked. Slots that start sooner than the notice time
//  (Admin → Settings) are already left out by the database.
//  The real "is it still free?" check happens again when the student pays
//  (hold_slot + the booking rules in the database), so two students can never
//  book the same slot.
// =====================================================================
import "server-only";
import { slotStartsAt } from "./slot-time";
import { getPublicSupabase } from "./supabase/public";

export type BoardSlot = { id: string; date: string; start_time: string; end_time: string; price: number; booked: boolean };
/** ready = false → nothing could be loaded (Supabase not connected or failed). today = India date on the server. */
export type SlotBoard = { slots: BoardSlot[]; ready: boolean; today: string };

const DAYS = 60;

export async function getSlotBoard(): Promise<SlotBoard> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const db = getPublicSupabase();
  if (!db) return { slots: [], ready: false, today };
  // Free any 10-minute payment holds that ran out, so those slots show as free again
  await db.rpc("release_expired_holds").then(() => undefined, () => undefined);

  const { data, error } = await db.rpc("slot_board", { p_days: DAYS });
  if (!error) {
    return {
      ready: true,
      today,
      slots: ((data ?? []) as BoardSlot[]).map((s) => ({
        id: s.id,
        date: String(s.date).slice(0, 10),
        start_time: String(s.start_time).slice(0, 8),
        end_time: String(s.end_time).slice(0, 8),
        price: Number(s.price),
        booked: !!s.booked,
      })),
    };
  }

  // supabase/voice-calls.sql not run yet → open slots only (booked ones can't be shown)
  const until = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(Date.now() + DAYS * 86_400_000));
  const open = await db
    .from("slots")
    .select("id,date,start_time,end_time,price")
    .eq("is_available", true)
    .gte("date", today)
    .lte("date", until)
    .order("date")
    .order("start_time");
  if (open.error) return { slots: [], ready: false, today };
  const cutoff = Date.now() + 60 * 60_000; // default notice: 60 minutes
  return {
    ready: true,
    today,
    slots: (open.data ?? [])
      .filter((s) => slotStartsAt(s.date as string, s.start_time as string).getTime() > cutoff)
      .map((s) => ({ id: s.id as string, date: s.date as string, start_time: s.start_time as string, end_time: s.end_time as string, price: Number(s.price), booked: false })),
  };
}
