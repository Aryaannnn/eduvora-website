// Icons that can be picked for the "Why EDUVORA?" cards (home page + Admin → Settings)
import type { WhyIcon } from "@/lib/why-shared";
import { AwardIcon, BookIcon, CalendarIcon, ChatIcon, GraduationIcon, HeadsetIcon, RocketIcon, ShieldIcon, TargetIcon, UsersIcon } from "../Icons";

export const WHY_ICON_COMPONENTS: Record<WhyIcon, (p: { className?: string }) => React.ReactNode> = {
  graduation: GraduationIcon,
  users: UsersIcon,
  headset: HeadsetIcon,
  target: TargetIcon,
  award: AwardIcon,
  shield: ShieldIcon,
  rocket: RocketIcon,
  calendar: CalendarIcon,
  book: BookIcon,
  chat: ChatIcon,
};

export const WHY_ICON_LABELS: Record<WhyIcon, string> = {
  graduation: "Graduation cap",
  users: "People",
  headset: "Headset (counselling)",
  target: "Target (predictor)",
  award: "Award",
  shield: "Shield (trust)",
  rocket: "Rocket",
  calendar: "Calendar",
  book: "Book",
  chat: "Chat",
};
