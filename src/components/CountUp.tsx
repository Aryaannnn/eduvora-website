"use client";

import { useEffect, useRef } from "react";

// Number that counts up from 0 when it scrolls into view.
export default function CountUp({ value, suffix = "", duration = 1600 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = (n: number) => {
      el.textContent = Math.round(n).toLocaleString("en-IN") + suffix;
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      show(value);
      return;
    }

    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        show(value * (1 - Math.pow(1 - t, 3))); // ease-out
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, suffix, duration]);

  return (
    <span ref={ref} aria-label={`${value.toLocaleString("en-IN")}${suffix}`}>
      0{suffix}
    </span>
  );
}
