"use client";

// The Rank Predictor on the HOME page is far down the page. Its code (~32 KB)
// is only downloaded when the visitor scrolls near it, so the top of the home
// page becomes usable sooner on slow phones. (The /predictor page loads it at once.)
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import type PredictorToolType from "./PredictorTool";

const PredictorTool = dynamic(() => import("./PredictorTool"), { ssr: false, loading: () => <Placeholder /> });

function Placeholder() {
  return <div className="card min-h-[24rem] animate-pulse bg-slate-100" role="status" aria-busy="true" aria-label="Loading the Rank Predictor" />;
}

export default function LazyPredictorTool(props: ComponentProps<typeof PredictorToolType>) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Old browsers without IntersectionObserver: just load it
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setNear(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" }, // start loading a little before it scrolls into view
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return <div ref={box}>{near ? <PredictorTool {...props} /> : <Placeholder />}</div>;
}
