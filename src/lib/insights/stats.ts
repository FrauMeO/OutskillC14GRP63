// Small, dependency-free statistics for the Insights page. Each function is checked against
// textbook values in stats.test.ts.

// ---------- Distributions ----------

// Standard normal CDF via the Abramowitz and Stegun 7.1.26 erf approximation (error < 1.5e-7).
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

function logGamma(z: number): number {
  // Lanczos approximation (g = 7, n = 9).
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let a = c[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

// Continued fraction for the regularized incomplete beta function (Numerical Recipes betacf).
function betaContinuedFraction(a: number, b: number, x: number): number {
  const EPS = 1e-12, FPMIN = 1e-300;
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

// Two-sided p-value for a t statistic with df degrees of freedom.
export function tTwoSidedP(t: number, df: number): number {
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

// ---------- Ranks ----------

// Ranks starting at 1; tied values share the average of their ranks.
export function averageRanks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
  const ranks = new Array<number>(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k][1]] = rank;
    i = j + 1;
  }
  return ranks;
}

function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

// ---------- Tests ----------

export type SpearmanResult = { rho: number; p: number; n: number };

// Spearman rank correlation with the t approximation. Null when either side never varies.
export function spearman(x: number[], y: number[]): SpearmanResult | null {
  const n = x.length;
  if (n < 3 || y.length !== n) return null;
  const rho = pearson(averageRanks(x), averageRanks(y));
  if (rho === null) return null;
  if (Math.abs(rho) >= 1) return { rho, p: 0, n };
  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho));
  return { rho, p: tTwoSidedP(t, n - 2), n };
}

export type MannWhitneyResult = { u: number; z: number; p: number; rankBiserial: number; n1: number; n2: number };

// Mann-Whitney U, normal approximation with tie correction and continuity correction.
// rankBiserial > 0 means group `a` tends to be higher than group `b`.
export function mannWhitney(a: number[], b: number[]): MannWhitneyResult | null {
  const n1 = a.length, n2 = b.length, n = n1 + n2;
  if (n1 === 0 || n2 === 0) return null;
  const all = [...a, ...b];
  const ranks = averageRanks(all);
  const r1 = ranks.slice(0, n1).reduce((s, r) => s + r, 0);
  const u = r1 - (n1 * (n1 + 1)) / 2;
  const mu = (n1 * n2) / 2;

  const counts = new Map<number, number>();
  for (const v of all) counts.set(v, (counts.get(v) ?? 0) + 1);
  const tieTerm = [...counts.values()].reduce((s, t) => s + (t ** 3 - t), 0);
  const variance = ((n1 * n2) / 12) * (n + 1 - tieTerm / (n * (n - 1)));
  if (variance <= 0) return null;

  const z = (Math.abs(u - mu) - 0.5) / Math.sqrt(variance);
  const p = Math.min(1, 2 * (1 - normalCdf(Math.max(0, z))));
  return { u, z: Math.sign(u - mu) * Math.max(0, z), p, rankBiserial: (2 * u) / (n1 * n2) - 1, n1, n2 };
}

// Benjamini-Hochberg adjusted p-values, returned in the input order.
export function benjaminiHochberg(pValues: number[]): number[] {
  const m = pValues.length;
  const order = pValues.map((p, i) => [p, i] as const).sort((x, y) => x[0] - y[0]);
  const adjusted = new Array<number>(m);
  let running = 1;
  for (let k = m - 1; k >= 0; k--) {
    const [p, i] = order[k];
    running = Math.min(running, (p * m) / (k + 1));
    adjusted[i] = Math.min(1, running);
  }
  return adjusted;
}
