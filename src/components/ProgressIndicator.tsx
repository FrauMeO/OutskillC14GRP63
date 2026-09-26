import type { Progress } from '../lib/dashboard';

// A ring (Apple Health values) or a horizontal bar (manual values). The percentage is always
// shown as text too, so colour is never the only signal.
export default function ProgressIndicator({
  kind,
  progress,
  color,
  label,
}: {
  kind: 'ring' | 'bar';
  progress: Progress;
  color: string; // CSS colour, e.g. var(--color-ember)
  label: string; // spoken summary, e.g. "Steps: 5,241 of 8,000, 66 percent"
}) {
  if (kind === 'ring') {
    const r = 20;
    const c = 2 * Math.PI * r;
    return (
      <svg viewBox="0 0 48 48" className="h-14 w-14 shrink-0" role="img" aria-label={label}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--color-mist)" strokeWidth="6" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${c * progress.fill} ${c}`}
          transform="rotate(-90 24 24)"
        />
        <text x="24" y="28" textAnchor="middle" className="fill-spruce text-[11px] font-semibold">
          {progress.percent}%
        </text>
      </svg>
    );
  }
  return (
    <div className="flex w-full items-center gap-2" role="img" aria-label={label}>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-mist">
        <div className="h-full rounded-full" style={{ width: `${progress.fill * 100}%`, background: color }} />
      </div>
      <span className="w-12 text-right text-sm font-semibold tabular-nums">{progress.percent}%</span>
    </div>
  );
}
