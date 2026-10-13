// Stands in for src/lib/supabase.ts during the build-time prerender only. Public pages are rendered
// with no session and no network call, and effects never run in renderToString, so this object is
// never called. If a public page ever does call it, the error below fails the build loudly.
const refuse = () => {
  throw new Error('A public page called Supabase while being prerendered. Public pages must not need a session or the network.');
};

export const supabase = new Proxy({}, { get: refuse }) as never;
