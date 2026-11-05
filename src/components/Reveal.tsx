"use client";

import { useEffect, useRef } from "react";

// Wrap anything in <Reveal> to make it fade-and-slide in when scrolled into view.
export default function Reveal({
  children,
  className = "",
  delay = 0,
  id,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  delay?: number; // milliseconds
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} id={id} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
