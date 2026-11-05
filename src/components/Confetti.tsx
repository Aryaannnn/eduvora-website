// Light CSS confetti (no library). Navy + gold + white pieces fall once.
// Turned off automatically for people who prefer reduced motion.
const COLORS = ["#f2a900", "#ffd166", "#0b2a5b", "#1d4ed8", "#ffffff", "#22c55e"];

export default function Confetti({ pieces = 70 }: { pieces?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden" aria-hidden>
      {Array.from({ length: pieces }, (_, i) => {
        // "random-looking" but fixed numbers, so server and browser match
        const left = (i * 37) % 100;
        const delay = ((i * 53) % 25) / 10; // 0–2.4s
        const duration = 2.6 + ((i * 29) % 20) / 10; // 2.6–4.5s
        const size = 6 + ((i * 17) % 7);
        const rotate = (i * 47) % 360;
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${left}%`,
              width: size,
              height: size * (i % 3 === 0 ? 1 : 0.45),
              background: COLORS[i % COLORS.length],
              borderRadius: i % 4 === 0 ? "9999px" : "2px",
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              transform: `rotate(${rotate}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}
