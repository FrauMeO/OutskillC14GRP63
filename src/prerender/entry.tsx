// Build-time entry for the static public pages. scripts/prerender.mjs loads this through Vite
// (ssrLoadModule) and writes the HTML into dist/. It renders the pages directly, with no session and
// no network call: the Supabase client is swapped for an inert stub in that step (see scripts/prerender.mjs).
import { Suspense, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AuthProvider } from '../context/AuthContext';
import PageSkeleton from '../components/PageSkeleton';
import Landing from '../pages/Landing';
import Sharing from '../pages/Sharing';
import Why from '../pages/Why';
import Privacy from '../pages/Privacy';
import Terms from '../pages/Terms';
import HealthDataPrivacy from '../pages/HealthDataPrivacy';
import { PUBLIC_ROUTES } from '../lib/siteMeta';

const PAGES: Record<string, ComponentType> = {
  '/': Landing,
  '/sharing': Sharing,
  '/why': Why,
  '/privacy': Privacy,
  '/terms': Terms,
  '/health-data-privacy': HealthDataPrivacy,
};

export { PUBLIC_ROUTES };

/** The page body as HTML text for one public route. Throws for a route that has no page, so a missing page fails the build. */
export function renderPublicPage(path: string): string {
  const Page = PAGES[path];
  if (!Page) throw new Error(`No public page for ${path}`);
  // In the app every page except "/" is lazy-loaded inside a <Suspense> (src/App.tsx). The same boundary
  // here puts the markers in the HTML that React looks for when it hydrates, so the text is kept, not rebuilt.
  const page = path === '/' ? <Page /> : <Suspense fallback={<PageSkeleton />}><Page /></Suspense>;
  return renderToString(
    <StaticRouter location={path}>
      <AuthProvider>{page}</AuthProvider>
    </StaticRouter>,
  );
}
