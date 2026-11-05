"use client";

import { useEffect, useRef, useState } from "react";

// Colour tiers for the gauge (by how many students you are ahead of)
export function tierFor(percentile: number) {
  if (percentile >= 95) return { label: "Excellent", stroke: "#10b981", text: "text-emerald-600", bg: "bg-emerald-50" };
  if (percentile >= 80) return { label: "Very good", stroke: "#2b5a9e", text: "text-brand-600", bg: "bg-brand-50" };
  if (percentile >= 50) return { label: "Good", stroke: "#f59e0b", text: "text-amber-600", bg: "bg-amber-50" };
  return { label: "Keep pushing", stroke: "#f43f5e", text: "text-rose-600", bg: "bg-rose-50" };
}

/** Smoothly animates a number from its old value to the new one */
function useAnimatedNumber(value: number, ms = 700) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, ms]);
  return shown;
}

// Half-circle gauge: fuller = better rank
export default function RankGauge({ rank, percentile }: { rank: number; percentile: number }) {
  const tier = tierFor(percentile);
  const animatedRank = useAnimatedNumber(rank);
  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <svg viewBox="0 0 200 116" className="w-full" role="img" aria-label={`Predicted rank about ${rank.toLocaleString("en-IN")}, better than ${percentile}% of students`}>
        <defs>
          <linearGradient id="gauge-bg" x1="0" x2="1">
            <stop offset="0%" stopColor="#fecdd3" />
            <stop offset="50%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#a7f3d0" />
          </linearGradient>
        </defs>
        <path d="M 16 100 A 84 84 0 0 1 184 100" fill="none" stroke="url(#gauge-bg)" strokeWidth="14" strokeLinecap="round" opacity="0.6" />
        <path
          d="M 16 100 A 84 84 0 0 1 184 100"
          fill="none"
          stroke={tier.stroke}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - Math.max(percentile, 1)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1), stroke 600ms" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Predicted rank</p>
        <p className="text-4xl font-extrabold tabular-nums text-slate-900 sm:text-5xl">~{animatedRank.toLocaleString("en-IN")}</p>
      </div>
    </div>
  );
}
