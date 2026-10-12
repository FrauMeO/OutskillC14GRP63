// Stand-in for @supabase/realtime-js, which this app never uses (no live subscriptions). The real
// package is about 17 KB gzip that every visitor would download for nothing, so vite.config.ts
// aliases it to this file. Supabase-js builds a RealtimeClient in its constructor and calls
// setAuth() when the session changes; those stay harmless no-ops. Anything that would really open
// a channel fails loudly instead of silently doing nothing.
// supabaseStubs.test.ts checks that the real supabase-js still works with this stand-in.
// To use realtime later, delete the alias in vite.config.ts.
export class RealtimeClient {
  constructor(..._args: unknown[]) {
    void _args;
  }
  setAuth(..._args: unknown[]): Promise<void> {
    void _args;
    return Promise.resolve();
  }
  channel(..._args: unknown[]): never {
    void _args;
    throw new Error('Realtime is not included in this build. Remove the alias in vite.config.ts to use it.');
  }
  getChannels(): unknown[] {
    return [];
  }
  removeChannel(..._args: unknown[]): Promise<string> {
    void _args;
    return Promise.resolve('ok');
  }
  removeAllChannels(): Promise<string[]> {
    return Promise.resolve([]);
  }
  disconnect(): void {}
}
