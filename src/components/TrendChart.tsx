import { useId, useState } from 'react';
import { chartScale, segments } from '../lib/chartScale';

export type TrendMetric = {
  key: string;
  label: string;
  unit: string;
  points: { date: string; value: number | null }[];
  goal: number | null;
  domain?: [number, number];
  decimals: number;
};

const weekday = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
};

// Plot area inside a 320 x 176 drawing that scales to the card's width.
const W = 320;
const H = 176;
const PAD = { top: 12, right: 18, bottom: 24, left: 36 };

// One seven-day line chart for a card, with a toggle between that card's metrics.
// Missing days are gaps in the line, not zero. The goal is a dashed line.
// Drawn as plain SVG (no chart library) so the Dashboard stays small on a slow connection.
export default function TrendChart({ title, color, metrics }: { title: string; color: string; metrics: TrendMetric[] }) {
  const id = useId();
  const [active, setActive] = useState(metrics[0].key);
  const m = metrics.find((x) => x.key === active) ?? metrics[0];
  const fmt = (v: number) => `${v.toFixed(m.decimals)}${m.unit ? ` ${m.unit}` : ''}`;
  const logged = m.points.filter((p) => p.value !== null);

  const values = m.points.map((p) => p.value);
  const scale = chartScale(values, m.goal, m.domain, m.decimals === 0);
  const n = Math.max(1, m.points.length - 1);
  const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / n;
  const y = (v: number) => PAD.top + (1 - (v - scale.min) / (scale.max - scale.min || 1)) * (H - PAD.top - PAD.bottom);
  const tick = (t: number) => String(Number(t.toFixed(m.decimals > 0 ? 1 : 0)));

  return (
    <figure className="rounded-lg border border-line bg-white p-4 md:p-5" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="font-display text-lg font-bold">
        {title}: last 7 days
      </figcaption>
      {metrics.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`${title} chart metric`}>
          {metrics.map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={x.key === active}
              onClick={() => setActive(x.key)}
              className={`min-h-11 rounded-full border px-3 text-sm ${
                x.key === active ? 'border-spruce bg-spruce text-mist' : 'border-line hover:bg-mist'
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block w-full" aria-hidden>
        {scale.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={PAD.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="currentColor">
              {tick(t)}
            </text>
          </g>
        ))}
        {m.points.map((p, i) => (
          <text key={p.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="currentColor">
            {weekday(p.date)}
          </text>
        ))}
        {m.goal !== null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(m.goal)} y2={y(m.goal)} stroke="var(--color-spruce)" strokeDasharray="5 4" />
            <text x={W - PAD.right} y={y(m.goal) - 3} textAnchor="end" fontSize="10" fill="currentColor">
              Goal
            </text>
          </g>
        )}
        {segments(values).map((run) =>
          run.length > 1 ? (
            <polyline
              key={run[0].index}
              points={run.map((p) => `${x(p.index)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null,
        )}
        {m.points.map((p, i) =>
          p.value === null ? null : (
            <circle key={p.date} cx={x(i)} cy={y(p.value)} r="3.5" fill={color}>
              <title>{`${weekday(p.date)}: ${fmt(p.value)}`}</title>
            </circle>
          ),
        )}
      </svg>
      {/* The same numbers as text, for screen readers. */}
      <ul className="sr-only">
        {m.points.map((p) => (
          <li key={p.date}>
            {weekday(p.date)}: {p.value === null ? 'Day off' : fmt(p.value)}
          </li>
        ))}
        {m.goal !== null && <li>Goal: {fmt(m.goal)}</li>}
      </ul>
      {logged.length === 0 && <p className="text-sm text-moss">All seven days were days off for {m.label.toLowerCase()}.</p>}
    </figure>
  );
}
