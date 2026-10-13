import { useState } from 'react';
import { MARK_EVERY, isMarkedDay } from '../lib/milestones';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// A month of the person's history: a check on every logged day, and every 5th completed day
// (5th, 10th, 15th... over all time, not necessarily in a row) in the milestone colour with a star.
// Days without a log are simply blank: nothing marks a missed day.
export default function MonthCalendar({
  dayNumbers,
  todayIso,
  selected,
  onSelect,
}: {
  dayNumbers: Map<string, number>;
  todayIso: string;
  selected: string;
  onSelect: (iso: string) => void;
}) {
  const [ty, tm] = todayIso.split('-').map(Number);
  const [view, setView] = useState({ y: ty, m: tm - 1 });
  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const lead = first.getDay(); // blank cells before the 1st (weeks start on Sunday)
  const title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 1, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }));
  const isCurrentMonth = view.y === ty && view.m === tm - 1;

  const move = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const logged = [...dayNumbers.keys()].filter((d) => d.startsWith(`${view.y}-${pad(view.m + 1)}`)).length;

  return (
    <section aria-labelledby="month-title" className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="min-h-11 min-w-11 rounded-md hover:bg-mist" aria-label="Previous month">
          ‹
        </button>
        <h3 id="month-title" className="font-semibold">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={isCurrentMonth}
          className="min-h-11 min-w-11 rounded-md hover:bg-mist disabled:opacity-30"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-moss" aria-hidden>
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <ol className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`blank-${i}`} aria-hidden />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = iso(view.y, view.m, day);
          const n = dayNumbers.get(date);
          const marked = isMarkedDay(n);
          const future = date > todayIso;
          const label = `${new Date(view.y, view.m, day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}: ${
            n ? (marked ? `logged, your ${n}th completed day` : 'logged') : 'Day off'
          }`;
          return (
            <li key={date}>
              <button
                type="button"
                disabled={future}
                onClick={() => onSelect(date)}
                aria-label={label}
                aria-current={date === selected ? 'date' : undefined}
                className={`flex min-h-11 w-full flex-col items-center justify-center rounded-md border text-xs disabled:opacity-40 ${
                  marked ? 'border-sun bg-sun/15 font-semibold' : n ? 'border-line bg-mist/60' : 'border-transparent hover:bg-mist'
                } ${date === selected ? 'ring-2 ring-spruce' : ''} ${date === todayIso ? 'underline underline-offset-2' : ''}`}
              >
                <span>{day}</span>
                <span aria-hidden className={marked ? 'text-sun' : 'text-green-700'}>
                  {marked ? '★' : n ? '✓' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-moss">
        {logged} {logged === 1 ? 'day' : 'days'} logged this month. <span className="text-sun">★</span> marks every {MARK_EVERY}th day you
        have logged.
      </p>
    </section>
  );
}
