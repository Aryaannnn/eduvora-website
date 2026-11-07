"use client";

import { useEffect } from "react";
import { trackOnce, type EventName } from "@/lib/analytics";

/** Sends one analytics event when the page opens (once per key, so a refresh doesn't count twice). */
export default function TrackEvent({ name, onceKey, props }: { name: EventName; onceKey: string; props?: Record<string, string | number | boolean | null> }) {
  const json = JSON.stringify(props ?? {});
  useEffect(() => {
    trackOnce(onceKey, name, JSON.parse(json));
  }, [name, onceKey, json]);
  return null;
}
