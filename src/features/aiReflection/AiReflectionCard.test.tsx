// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { clearConsent, writeConsent } from '../../lib/aiConsent';
const state = vi.hoisted(() => ({ user: 'u1', allowed: true, invoke: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: state.user } }) }));
vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke: state.invoke } } }));
vi.mock('./useAiConsent', () => ({ useAiConsent: () => ({ allowed: state.allowed, grant: vi.fn(), notNow: vi.fn() }) }));
vi.mock('../../lib/useDataSaver', () => ({ useDataSaver: () => ({ saveData: false }) }));
vi.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a href={to} {...props}>{children}</a> }));
vi.stubEnv('VITE_AI_REFLECTION', 'on');
const { default: Card } = await import('./AiReflectionCard');
let root: Root;
let host: HTMLDivElement;
let serial = 0;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.invoke.mockReset(); state.allowed = true; state.user = `user-${++serial}`;
  writeConsent(state.user, true);
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); clearConsent(state.user); });
const render = async (auto = false, water = 1, date = '2026-10-13') => act(async () => root.render(<Card date={date} today={{ water_liters: water }} auto={auto} />));
const click = async (text: string) => act(async () => {
  const button = [...host.querySelectorAll('button')].find(b => b.textContent === text);
  expect(button).toBeTruthy(); button!.click();
});
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(r => { resolve = r; });
  state.invoke.mockReturnValueOnce(promise);
  return async (text = 'Current reflection') => act(async () => resolve({ data: { text, source: 'fixed' }, error: null }));
}
it('positive control: allowed response displays and essential disclosures use readable text', async () => {
  const finish = deferred(); await render(); await click('Reflect on today'); await finish();
  expect(host.textContent).toContain('Current reflection');
  expect(host.querySelector('.text-xs')).toBeNull();
  expect([...host.querySelectorAll('button')].every(b => b.className.includes('min-h-12'))).toBe(true);
});
it('withdraw -> resolve -> regrant never resurrects output or automatic cache', async () => {
  const finish = deferred(); await render(true);
  state.allowed = false; writeConsent(state.user, false); await render(true); await finish('Withdrawn output');
  state.allowed = true; writeConsent(state.user, true); const fresh = deferred(); await render(true);
  expect(host.textContent).not.toContain('Withdrawn output'); await fresh('Fresh output');
  expect(host.textContent).toContain('Fresh output');
});
it('checks consent directly even before React processes withdrawal', async () => {
  const finish = deferred(); await render(); await click('Reflect on today'); writeConsent(state.user, false); await finish('Stale');
  expect(host.textContent).not.toContain('Stale');
});
it.each(['account', 'entry', 'date'] as const)('discards old %s context and accepts fresh result in reverse order', async (change) => {
  const old = deferred(); await render(true);
  if (change === 'account') { state.user = 'different-user'; writeConsent(state.user, true); }
  const fresh = deferred(); await render(true, change === 'entry' ? 2 : 1, change === 'date' ? '2026-10-14' : '2026-10-13');
  await fresh('New context'); await old('Old context');
  expect(host.textContent).toContain('New context'); expect(host.textContent).not.toContain('Old context');
});
it('unmount cannot populate navigation cache; current scoped cache avoids duplicate requests', async () => {
  const old = deferred(); await render(true); await act(async () => root.unmount()); await old('Unmounted');
  root = createRoot(host); const fresh = deferred(); await render(true); await fresh('Fresh mounted');
  expect(state.invoke).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount()); root = createRoot(host); await render(true);
  expect(state.invoke).toHaveBeenCalledTimes(2); expect(host.textContent).toContain('Fresh mounted');
});
it('thrown transport failure restores retry and does not erase consent', async () => {
  state.invoke.mockRejectedValueOnce(new Error('offline')); await render(); await click('Reflect on today');
  expect(host.textContent).toContain('Please try again');
  const finish = deferred(); await click('Reflect on today'); await finish(); expect(host.textContent).toContain('Current reflection');
});
it('denied positive control sends no request', async () => {
  state.allowed = false; writeConsent(state.user, false); await render(true); expect(state.invoke).not.toHaveBeenCalled();
});

it('account B without consent never invokes using account A rendered permission', async () => {
  const old = deferred(); await render(true);
  state.user = 'never-consented'; clearConsent(state.user); await render(true);
  expect(state.invoke).toHaveBeenCalledTimes(1); await old('Account A only');
  expect(host.textContent).not.toContain('Account A only');
});
it('Back invalidates a pending week request and a retry wins reverse completion order', async () => {
  const day = deferred(); await render(); await click('Reflect on today'); await day('Day result');
  const week = deferred(); await click('Coach me on my week'); await click('Back');
  const fresh = deferred(); await click('Reflect on today'); await fresh('Replacement day'); await week('Late week');
  expect(host.textContent).toContain('Replacement day'); expect(host.textContent).not.toContain('Late week');
});

it('StrictMode sends only one automatic request during effect replay', async () => {
  const finish = deferred();
  await act(async () => root.render(<StrictMode><Card date="2026-10-13" today={{ water_liters: 1 }} auto /></StrictMode>));
  expect(state.invoke).toHaveBeenCalledTimes(1); await finish('StrictMode result');
  expect(host.textContent).toContain('StrictMode result');
});
