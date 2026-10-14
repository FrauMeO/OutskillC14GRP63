// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useAiConsent } from './useAiConsent';
import { clearConsent, writeConsent } from '../../lib/aiConsent';
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: vi.fn().mockResolvedValue({ error: null }) } }));
it('never returns previous-account consent even during the first account-change render', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement('div'); const root = createRoot(host);
  const renders: { id: string; allowed: boolean }[] = [];
  function Probe({ id }: { id: string }) { const { allowed } = useAiConsent(id); renders.push({ id, allowed }); return null; }
  writeConsent('hook-a', true); clearConsent('hook-b');
  await act(async () => root.render(<Probe id="hook-a" />));
  expect(renders.some(r => r.id === 'hook-a' && r.allowed)).toBe(true);
  await act(async () => root.render(<Probe id="hook-b" />));
  expect(renders.filter(r => r.id === 'hook-b').every(r => !r.allowed)).toBe(true);
  await act(async () => root.unmount()); clearConsent('hook-a'); clearConsent('hook-b');
});
