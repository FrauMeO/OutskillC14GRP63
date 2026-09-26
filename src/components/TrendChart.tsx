import { useId, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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

// One seven-day line chart for a card, with a toggle between that card's metrics.
// Missing days are gaps in the line, not zero. The goal is a dashed reference line.
export default function TrendChart({ title, color, metrics }: { title: string; color: string; metrics: TrendMetric[] }) {
  const id = useId();
  const [active, setActive] = useState(metrics[0].key);
  const m = metrics.find((x) => x.key === active) ?? metrics[0];
  const fmt = (v: number) => `${v.toFixed(m.decimals)}${m.unit ? ` ${m.unit}` : ''}`;
  const logged = m.points.filter((p) => p.value !== null);

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
      <div className="mt-3 h-44 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={m.points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={weekday} tick={{ fontSize: 12 }} />
            <YAxis domain={m.domain ?? [0, 'auto']} tick={{ fontSize: 12 }} allowDecimals={m.decimals > 0} />
            <Tooltip
              labelFormatter={(d) => weekday(String(d))}
              formatter={(v) => [fmt(Number(v)), m.label]}
            />
            {m.goal !== null && (
              <ReferenceLine y={m.goal} stroke="var(--color-spruce)" strokeDasharray="5 4" label={{ value: 'Goal', position: 'insideTopRight', fontSize: 11 }} />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: color }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* The same numbers as text, for screen readers. */}
      <ul className="sr-only">
        {m.points.map((p) => (
          <li key={p.date}>
            {weekday(p.date)}: {p.value === null ? 'not logged' : fmt(p.value)}
          </li>
        ))}
        {m.goal !== null && <li>Goal: {fmt(m.goal)}</li>}
      </ul>
      {logged.length === 0 && <p className="text-sm text-spruce/70">No {m.label.toLowerCase()} logged in the last 7 days.</p>}
    </figure>
  );
}
