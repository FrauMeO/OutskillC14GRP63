import { describe, expect, it } from 'vitest';
import { averageRanks, benjaminiHochberg, mannWhitney, normalCdf, spearman, tTwoSidedP } from './stats';

describe('distributions (textbook values)', () => {
  it('normal CDF', () => {
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5);
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 5);
  });

  it('t distribution: t = 2.228 with 10 df is the two-sided 5% point', () => {
    expect(tTwoSidedP(2.228, 10)).toBeCloseTo(0.05, 3);
    expect(tTwoSidedP(0, 10)).toBeCloseTo(1, 6);
    // Control: a larger t gives a smaller p.
    expect(tTwoSidedP(3.169, 10)).toBeCloseTo(0.01, 3);
  });
});

describe('averageRanks', () => {
  it('shares ranks between ties', () => {
    expect(averageRanks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });
});

describe('spearman', () => {
  it('matches the classic IQ and TV-hours example: rho = -29/165, p about 0.63', () => {
    const iq = [106, 100, 86, 101, 99, 103, 97, 113, 112, 110];
    const tv = [7, 27, 2, 50, 28, 29, 20, 12, 6, 17];
    const r = spearman(iq, tv)!;
    expect(r.rho).toBeCloseTo(-29 / 165, 6);
    expect(r.p).toBeCloseTo(0.627, 2);
  });

  it('is 1 for a perfect monotone relation, and null when one side never varies', () => {
    expect(spearman([1, 2, 3, 4], [1, 4, 9, 16])!.rho).toBeCloseTo(1, 9);
    expect(spearman([1, 2, 3, 4], [5, 5, 5, 5])).toBeNull();
  });
});

describe('mannWhitney', () => {
  it('fully separated groups of 5: U = 0, p about 0.0122 (asymptotic with continuity correction)', () => {
    const r = mannWhitney([1, 2, 3, 4, 5], [6, 7, 8, 9, 10])!;
    expect(r.u).toBe(0);
    expect(r.p).toBeCloseTo(0.0122, 3);
    expect(r.rankBiserial).toBe(-1);
  });

  it('control: identical groups give p = 1 and no effect', () => {
    const r = mannWhitney([1, 2, 3, 4], [1, 2, 3, 4])!;
    expect(r.p).toBeCloseTo(1, 6);
    expect(r.rankBiserial).toBeCloseTo(0, 9);
  });
});

describe('benjaminiHochberg', () => {
  it('matches the 25-test example from the Handbook of Biological Statistics', () => {
    const p = [0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205, 0.212, 0.216, 0.222, 0.251, 0.269,
      0.275, 0.34, 0.341, 0.384, 0.569, 0.594, 0.696, 0.762, 0.94, 0.942, 0.975, 0.986];
    const adj = benjaminiHochberg(p);
    // Adjusted p = min over later ranks of p * m / rank: 0.025, 0.1, then 0.042*25/5 = 0.21 carried
    // back to ranks 3 and 4, then 0.06*25/6 = 0.25 at rank 6 (exactly on the 25% line, a tie).
    [0.025, 0.1, 0.21, 0.21, 0.21, 0.25].forEach((v, i) => expect(adj[i]).toBeCloseTo(v, 9));
    // Below the tie, at 24%, exactly the first five pass (control: the sixth does not).
    expect(adj.filter((a) => a <= 0.24)).toHaveLength(5);
  });

  it('keeps input order', () => {
    const adj = benjaminiHochberg([0.04, 0.01]);
    expect(adj[1]).toBeLessThanOrEqual(adj[0]);
  });
});
