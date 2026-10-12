// Runs tests-safety/cases.json through the app's EXISTING safety checks. No network, no real data.
//   npx vite-node tests-safety/run-against-checker.mjs            (report; exit 1 only on NEW failures)
//   npx vite-node tests-safety/run-against-checker.mjs --strict   (exit 1 on any failure)
//   npx vite-node tests-safety/run-against-checker.mjs --update-baseline   (accept today's failures)
// tests-safety/baseline.json lists the case ids that fail today (known gaps). CI fails the build when a
// case outside the baseline fails (a regression), and prints when a baseline case starts passing.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCase } from './run-case.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { cases } = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf8'));
const baselinePath = join(here, 'baseline.json');
const baseline = new Set(
  (existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')).knownFailures : []).map((k) => (typeof k === 'string' ? k : k.id)),
);
const strict = process.argv.includes('--strict');

const results = cases.map((c) => ({ c, ...runCase(c) }));
const failed = results.filter((r) => !r.ok);
const regressions = failed.filter((r) => !baseline.has(r.c.id));
const fixed = results.filter((r) => r.ok && baseline.has(r.c.id));

console.log(`${results.length} cases, ${results.length - failed.length} pass, ${failed.length} fail (${regressions.length} new)\n`);
for (const sev of ['high', 'medium', 'low']) {
  const rows = failed.filter((r) => r.c.severity === sev);
  if (!rows.length) continue;
  console.log(`--- ${sev.toUpperCase()} (${rows.length}) ---`);
  for (const r of rows) console.log(`${baseline.has(r.c.id) ? ' known ' : ' NEW   '}${r.c.id} [${r.c.category}] ${r.c.why}\n         got: ${r.got}; want: ${r.want}`);
}
if (fixed.length) console.log(`\nNow passing, remove from baseline: ${fixed.map((r) => r.c.id).join(', ')}`);

if (process.argv.includes('--update-baseline')) {
  writeFileSync(baselinePath, JSON.stringify({ knownFailures: failed.map((r) => r.c.id), passCount: results.length - failed.length, total: results.length }, null, 2) + '\n');
  console.log('\nbaseline.json updated.');
  process.exit(0);
}
process.exit((strict ? failed.length : regressions.length) > 0 ? 1 : 0);
