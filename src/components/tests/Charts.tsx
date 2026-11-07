// Small, dependency-free charts (SVG / CSS) for test analytics.

/** Horizontal bars: label · bar · value. */
export function BarList({ rows, max = 100, suffix = "%" }: { rows: { label: string; value: number; color?: string; note?: string }[]; max?: number; suffix?: string }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 text-sm sm:grid-cols-[8rem_1fr_4rem]">
          <span className="truncate font-semibold text-slate-700" title={r.label}>{r.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${r.label}: ${r.value}${suffix}`}>
            <span className="block h-full rounded-full transition-all" style={{ width: `${max ? Math.min(100, (r.value / max) * 100) : 0}%`, background: r.color ?? "#2563eb" }} />
          </span>
          <span className="text-right font-bold tabular-nums text-slate-900">
            {r.value}{suffix}
            {r.note && <span className="block text-[10px] font-medium text-slate-400">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Vertical bars, one per question (seconds), coloured by result. */
export function QuestionTimeChart({ items }: { items: { n: number; seconds: number; result: "correct" | "wrong" | "skipped" }[] }) {
  const max = Math.max(1, ...items.map((i) => i.seconds));
  const color = { correct: "#16a34a", wrong: "#dc2626", skipped: "#94a3b8" };
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px] overflow-x-auto pb-1" role="img" aria-label="Time spent on each question">
        {items.map((i) => (
          <div key={i.n} className="group relative flex h-full min-w-[10px] flex-1 flex-col justify-end">
            <div className="w-full rounded-t" style={{ height: `${Math.max(2, (i.seconds / max) * 100)}%`, background: color[i.result] }} title={`Q${i.n}: ${i.seconds}s (${i.result})`} />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] overflow-hidden text-[9px] text-slate-400">
        {items.map((i) => <span key={i.n} className="min-w-[10px] flex-1 text-center">{items.length <= 30 || i.n % 5 === 0 ? i.n : ""}</span>)}
      </div>
      <p className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-green-600" /> Correct</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-red-600" /> Wrong</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Skipped</span>
        <span>· longest: {max}s</span>
      </p>
    </div>
  );
}

/** Line chart (0–100 %) with one or more series. */
export function LineChart({
  series, labels, height = 220,
}: {
  series: { name: string; color: string; points: (number | null)[] }[];
  labels: string[];
  height?: number;
}) {
  const W = 640, H = height, L = 34, R = 12, T = 12, B = 26;
  const n = labels.length;
  const x = (i: number) => (n <= 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - v / 100) * (H - T - B);
  const step = Math.max(1, Math.ceil(n / 8));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Scores over time">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#e2e8f0" strokeDasharray={g ? "3 4" : undefined} />
            <text x={L - 6} y={y(g) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">{g}%</text>
          </g>
        ))}
        {labels.map((l, i) => (i % step === 0 || i === n - 1 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">{l}</text> : null))}
        {series.map((s) => {
          const pts = s.points.map((v, i) => (v === null ? null : ([x(i), y(v)] as const)));
          // break the line where a test had no questions of this subject
          const segs: (readonly [number, number])[][] = [];
          let cur: (readonly [number, number])[] = [];
          for (const p of pts) {
            if (p) cur.push(p);
            else if (cur.length) { segs.push(cur); cur = []; }
          }
          if (cur.length) segs.push(cur);
          return (
            <g key={s.name}>
              {segs.map((seg, k) => <polyline key={k} points={seg.map((p) => p.join(",")).join(" ")} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />)}
              {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill="#fff" stroke={s.color} strokeWidth={2}><title>{`${s.name}: ${s.points[i]}% · ${labels[i]}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {series.map((s) => <span key={s.name} className="inline-flex items-center gap-1.5"><i className="h-2 w-4 rounded-full" style={{ background: s.color }} /> {s.name}</span>)}
        </p>
      )}
    </div>
  );
}
