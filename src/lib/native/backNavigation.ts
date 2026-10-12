// What the Android back button should do. Pure, so it is unit tested.
//
// React Router (BrowserRouter) keeps its own position in `window.history.state.idx`:
// 0 is the first screen the app opened on, 1 is one step in, and so on.

/** Screens where "back" should leave the app instead of walking backwards. */
export const ROOT_PATHS: readonly string[] = ['/', '/dashboard', '/login'];

export type BackAction = 'go-back' | 'go-home' | 'exit';

export function decideBack(input: { historyIndex: number | null; pathname: string }): BackAction {
  const { historyIndex, pathname } = input;
  if (ROOT_PATHS.includes(pathname)) return 'exit';
  if (historyIndex !== null && historyIndex > 0) return 'go-back';
  // Opened straight onto a deep screen (for example from a link) and nothing to go back to:
  // take the person to the dashboard once, rather than closing the app on them.
  return 'go-home';
}

/** Reads React Router's position from the browser history state. Null when unknown. */
export function readHistoryIndex(state: unknown): number | null {
  if (state && typeof state === 'object' && 'idx' in state) {
    const idx = (state as { idx: unknown }).idx;
    if (typeof idx === 'number' && Number.isFinite(idx)) return idx;
  }
  return null;
}
