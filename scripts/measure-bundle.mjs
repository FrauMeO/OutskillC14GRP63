// Measures what a visitor downloads (gzip level 9) from dist/ after `npm run build`.
//   node scripts/measure-bundle.mjs
// Landing (signed out, "/" -> /login): index.html + the entry chunk and its static imports + CSS +
// fonts that the CSS references. Dashboard (signed in): landing + the Dashboard route chunk, its
// static imports.
// Needs build.manifest = true (set in vite.config.ts). Fails if a budget is exceeded.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join } from 'node:path';

const DIST = 'dist';
const BUDGET = { landing: 150 * 1024, dashboard: 250 * 1024 };
const manifestPath = join(DIST, '.vite', 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('No dist/.vite/manifest.json. Run `npm run build` first.');
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const gz = (file) => gzipSync(readFileSync(join(DIST, file)), { level: 9 }).length;
const br = (file) => brotliCompressSync(readFileSync(join(DIST, file))).length;

const files = new Set();
function addChunk(key, seen = new Set()) {
  if (seen.has(key) || !manifest[key]) return;
  seen.add(key);
  const c = manifest[key];
  files.add(c.file);
  (c.css ?? []).forEach((f) => files.add(f));
  (c.assets ?? []).forEach((f) => files.add(f));
  (c.imports ?? []).forEach((k) => addChunk(k, seen));
}

function total(set) {
  let g = 0;
  let b = 0;
  const rows = [];
  for (const f of [...set].sort()) {
    const raw = readFileSync(join(DIST, f)).length;
    const z = gz(f);
    const r = br(f);
    g += z;
    b += r;
    rows.push(`  ${f.padEnd(52)} raw ${String(raw).padStart(8)}  gzip ${String(z).padStart(7)}`);
  }
  return { g, b, rows };
}

const entry = Object.keys(manifest).find((k) => manifest[k].isEntry);
files.clear();
files.add('index.html');
addChunk(entry);
const landingFiles = new Set(files);

addChunk('src/pages/Dashboard.tsx');
const dashFiles = new Set(files);

let failed = false;
for (const [name, set, budget] of [
  ['Signed-out landing page (/)', landingFiles, BUDGET.landing],
  ['Signed-in first Dashboard load', dashFiles, BUDGET.dashboard],
]) {
  const t = total(set);
  console.log(`\n${name}`);
  t.rows.forEach((r) => console.log(r));
  const ok = t.g <= budget;
  if (!ok) failed = true;
  console.log(`  TOTAL gzip ${(t.g / 1024).toFixed(1)} KB (brotli ${(t.b / 1024).toFixed(1)} KB), budget ${(budget / 1024).toFixed(0)} KB: ${ok ? 'OK' : 'OVER'}`);
}
process.exit(failed ? 1 : 0);
