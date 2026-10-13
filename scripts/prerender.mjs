// Post-build step: renders the public pages to static HTML so crawlers, answer engines and people on
// slow connections get real text, with the app still starting up on top (src/main.tsx).
//
//   npm run build  ->  tsc -b && vite build && node scripts/prerender.mjs
//
// For each public route it writes dist/<route>/index.html (dist/index.html for "/"). It also keeps a
// plain copy of the empty app shell as dist/app-shell.html; vercel.json sends every other route there.
// Nothing here calls the network or Supabase.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const shellFile = join(dist, 'index.html');
if (!existsSync(shellFile)) throw new Error('dist/index.html is missing. Run "vite build" first.');

// Keep the pristine shell the first time; on a re-run, start from it again.
const shellCopy = join(dist, 'app-shell.html');
if (!existsSync(shellCopy)) writeFileSync(shellCopy, readFileSync(shellFile, 'utf8'));
const shell = readFileSync(shellCopy, 'utf8');

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  plugins: [react()],
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: {
    alias: [
      // react-router-dom v7 only re-exports react-router; its CommonJS build hides those names from Node's ESM loader.
      { find: 'react-router-dom', replacement: 'react-router' },
      { find: /^(\.\.?\/)+lib\/supabase$|^\.\/supabase$/, replacement: join(root, 'src/prerender/supabaseStub.ts') },
    ],
  },
  // One copy of the router for the entry and the pages, so they share the same context.
  ssr: { noExternal: ['react-router'] },
});

try {
  const entry = await server.ssrLoadModule('/src/prerender/entry.tsx');
  const meta = await server.ssrLoadModule('/src/lib/siteMeta.ts');

  // The shell has its own <title> and description; swap them for the page's own head tags.
  const stripHead = (html) =>
    html
      .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
      .replace(/<meta name="description"[^>]*>\s*/i, '')
      .replace(/<meta property="og:(title|description|image|type|url)"[^>]*>\s*/gi, '');

  let count = 0;
  for (const { path } of meta.PUBLIC_ROUTES) {
    const body = entry.renderPublicPage(path);
    let html = stripHead(shell).replace('</head>', `    ${meta.headTags(path)}\n  </head>`);
    if (!html.includes('<div id="root"></div>')) throw new Error('index.html no longer has an empty <div id="root"></div>.');
    html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
    const out = path === '/' ? shellFile : join(dist, path.slice(1), 'index.html');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    count += 1;
    console.log(`prerendered ${path} -> ${out.replace(root + '/', '')} (${Math.round(html.length / 1024)} KB)`);
  }
  console.log(`prerender: ${count} public pages written`);
} finally {
  await server.close();
}
