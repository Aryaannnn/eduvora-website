import { connection } from "next/server";
import { getUpcomingSlots } from "@/lib/data";
import { formatDate, formatTime } from "@/lib/format";
import { firstBookable } from "@/lib/slot-time";
import { CalendarIcon } from "../Icons";

// "Next available slot: Sat, 21 Nov 2026 at 5:00 PM IST" — top of the Book a Slot page.
// (The booking form below shows the live, exact list.)
export default async function NextSlotBanner() {
  await connection(); // checked on each visit (it depends on the current time)
  const slots = await getUpcomingSlots(40);
  const next = firstBookable(slots, 60); // never show a slot that starts within the hour
  return (
    <a href="#book" className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white ring-1 ring-white/20 transition-colors hover:bg-white/15">
      <CalendarIcon className="h-4 w-4 text-accent-300" />
      {next ? (
        <span>Next available slot: <strong className="text-accent-300">{formatDate(next.date, true)} at {formatTime(next.start_time)} IST</strong></span>
      ) : (
        <span>No free slots right now — new slots are added every week.</span>
      )}
    </a>
  );
}
