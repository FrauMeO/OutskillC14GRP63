import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Stamps public/sw.js with a build id so every deploy gets fresh caches and the previous ones are
// deleted when the new worker activates (see public/sw.js).
function stampServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = join(outDir, 'sw.js');
      if (!existsSync(file)) return;
      const id = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
      writeFileSync(file, readFileSync(file, 'utf8').replace(/__BUILD_ID__/g, id));
    },
  };
}

// `vite preview` serves a folder's index.html only for a trailing-slash address, but Vercel serves it for
// "/sharing" too. This makes the local preview behave like the host, so the prerendered public pages
// (scripts/prerender.mjs writes dist/<route>/index.html) can be checked with plain curl, and app
// routes get the empty shell (dist/app-shell.html) the way the vercel.json rewrite sends them.
function servePrerenderedPages(): Plugin {
  return {
    name: 'serve-prerendered-pages',
    apply: 'serve',
    configurePreviewServer(server) {
      const dist = join(server.config.root, server.config.build.outDir);
      server.middlewares.use((req, _res, next) => {
        const [path, query = ''] = (req.url ?? '').split('?');
        if (path.length > 1 && !path.endsWith('/') && !path.includes('..') && existsSync(join(dist, path, 'index.html'))) {
          req.url = `${path}/index.html${query ? `?${query}` : ''}`;
        } else if (path !== '/' && !path.endsWith('/') && !/\.[A-Za-z0-9]+$/.test(path) && !existsSync(join(dist, path))) {
          req.url = '/app-shell.html'; // an app route: the empty shell, as vercel.json rewrites it
        }
        next();
      });
    },
  };
}

// Vendor code is split into long-lived chunks (React, the router, Supabase) that the browser and
// the service worker keep across deploys, because their hashes change only when the library does.
function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
  if (/node_modules\/(react-router|react-router-dom)\//.test(id)) return 'vendor-router';
  if (/node_modules\/@supabase\//.test(id)) return 'vendor-supabase';
  return undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stampServiceWorker(), servePrerenderedPages()],
  resolve: {
    alias: {
      // Unused by this app; about 24 KB gzip saved on every first visit. Guarded by src/lib/supabaseStubs.test.ts.
      '@supabase/realtime-js': fileURLToPath(new URL('./src/lib/stubs/realtime-js.ts', import.meta.url)),
      '@supabase/storage-js': fileURLToPath(new URL('./src/lib/stubs/storage-js.ts', import.meta.url)),
    },
  },
  build: {
    manifest: true, // lets scripts/measure-bundle.mjs work out what each page downloads
    chunkSizeWarningLimit: 400,
    rollupOptions: { output: { manualChunks: vendorChunk } },
  },
  test: {
    // Let the aliases above apply inside supabase-js during tests (src/lib/supabaseStubs.test.ts).
    server: { deps: { inline: [/@supabase\//] } },
  },
});
