// Wrap anything in <Reveal> to make it fade-and-slide in as it scrolls into view.
// Pure CSS (scroll-driven animation, see .reveal in globals.css) — no JavaScript:
//  • content that is already on screen when the page opens is visible immediately
//    (nothing waits for scripts — better for slow phones and Google's speed score)
//  • browsers without scroll-driven animations simply show the content
//  • "Reduce motion" setting → no animation
// `delay` is kept so existing code still works (staggered cards), but is optional.
export default function Reveal({
  children,
  className = "",
  delay = 0,
  id,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  delay?: number; // milliseconds (small stagger for cards in a row)
}) {
  return (
    <div id={id} className={`reveal ${className}`} style={delay ? ({ "--reveal-offset": `${Math.round(Math.min(delay, 300) / 10)}%` } as React.CSSProperties) : undefined}>
      {children}
    </div>
  );
}
