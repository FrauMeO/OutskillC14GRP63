// Scale and line segments for the small hand-drawn SVG trend charts (TrendChart.tsx). These
// replaced the recharts library, which was 107 KB gzip for seven-point line charts.

export type Scale = { min: number; max: number; ticks: number[] };

/** A round step (1, 2, 2.5, 5 times a power of ten) that fits `max` into about four intervals. */
export function niceStep(max: number, intervals = 4, integerOnly = false): number {
  const raw = Math.max(max, Number.EPSILON) / intervals;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow);
  return integerOnly ? Math.max(1, Math.ceil(step)) : step;
}

/**
 * Y scale. With a fixed `domain` (the 1 to 5 ratings) the ticks are its whole numbers. Otherwise the
 * axis starts at 0 and ends at a round number above the largest value or goal.
 */
export function chartScale(values: (number | null)[], goal: number | null, domain: [number, number] | undefined, integerOnly: boolean): Scale {
  if (domain) {
    const [min, max] = domain;
    const ticks: number[] = [];
    for (let t = Math.ceil(min); t <= max; t++) ticks.push(t);
    return { min, max, ticks };
  }
  const top = Math.max(0, goal ?? 0, ...values.filter((v): v is number => v !== null));
  const step = niceStep(top || 1, 4, integerOnly);
  const max = Math.max(step, Math.ceil(top / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= max + step / 1000; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return { min: 0, max, ticks };
}

/** Runs of consecutive logged days; a missing day (null) ends a run, so it is a gap, never a zero. */
export function segments(values: (number | null)[]): { index: number; value: number }[][] {
  const out: { index: number; value: number }[][] = [];
  let run: { index: number; value: number }[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (run.length) out.push(run);
      run = [];
    } else {
      run.push({ index, value });
    }
  });
  if (run.length) out.push(run);
  return out;
}
