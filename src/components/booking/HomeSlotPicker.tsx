"use client";

// Home page "How it works" card: the shared slot picker. A free time opens the
// Book a Slot form with that slot chosen. Refreshes every minute.
import type { SlotBoard } from "@/lib/slot-board";
import SlotPicker, { useSlotBoard } from "./SlotPicker";

export default function HomeSlotPicker({ initial }: { initial: SlotBoard }) {
  const [board] = useSlotBoard(initial);
  return <SlotPicker board={board} mode="link" />;
}
