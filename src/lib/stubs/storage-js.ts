// Stand-in for @supabase/storage-js (about 7 KB gzip), which this app never uses: nothing is uploaded
// to Supabase Storage. vite.config.ts aliases the package to this file; see realtime-js.ts.
export class StorageApiError extends Error {}

export class StorageClient {
  constructor(..._args: unknown[]) {
    void _args;
  }
  from(_bucket: string): never {
    void _bucket;
    throw new Error('Storage is not included in this build. Remove the alias in vite.config.ts to use it.');
  }
}
