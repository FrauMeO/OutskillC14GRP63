// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { ACCESS_REFRESH_MS, ACCESS_TIMEOUT_MS, SHARING_APP_ACTIVE, useFollowedPeople } from './useFollowedPeople';
const auth = vi.hoisted(() => ({ user: { id: 'viewer-a' } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn() } }));
let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
let current: ReturnType<typeof useFollowedPeople>;
function Probe() { current = useFollowedPeople(); return <div>{current.people.map(p => p.owner_id).join(',')}</div>; }
const person = { owner_id: 'owner-private', status: 'active' };
beforeEach(() => {
 Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers();vi.mocked(supabase.rpc).mockReset();auth.user={id:'viewer-a'};
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
 Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
 host=document.createElement('div');root=createRoot(host);
 vi.mocked(supabase.rpc).mockResolvedValue({data:[person],error:null} as never);
});
afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();});
it('clears the visible lease on interval before waiting for a revoke response',async()=>{
 await act(async()=>root.render(<Probe/>));expect(host.textContent).toBe('owner-private');
 let reply!: (r: unknown)=>void;
 vi.mocked(supabase.rpc).mockImplementationOnce(()=>new Promise(r=>{reply=r;}) as never);
 await act(async()=>vi.advanceTimersByTime(ACCESS_REFRESH_MS));expect(host.textContent).toBe('');
 await act(async()=>reply({data:[],error:null}));expect(current.people).toEqual([]);
});
it('fails closed on timeout and ignores a later successful stale reply',async()=>{
 let reply!: (r:unknown)=>void;
 vi.mocked(supabase.rpc).mockImplementationOnce(()=>new Promise(r=>{reply=r;}) as never);
 await act(async()=>root.render(<Probe/>));
 await act(async()=>vi.advanceTimersByTime(ACCESS_TIMEOUT_MS));expect(current.failed).toBeTruthy();
 await act(async()=>reply({data:[person],error:null}));expect(host.textContent).toBe('');
});
it('hides on background and offline, rechecks on foreground, and clears on failure',async()=>{
 await act(async()=>root.render(<Probe/>));
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
 await act(async()=>document.dispatchEvent(new Event('visibilitychange')));expect(host.textContent).toBe('');
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
 await act(async()=>document.dispatchEvent(new Event('visibilitychange')));expect(host.textContent).toBe('owner-private');
 await act(async()=>window.dispatchEvent(new Event('offline')));expect(host.textContent).toBe('');
 vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error('network'));
 await act(async()=>window.dispatchEvent(new Event('focus')));expect(current.failed).toBeTruthy();expect(host.textContent).toBe('');
});
it('never restores an old account or superseded request',async()=>{
 let reply!: (r:unknown)=>void;
 vi.mocked(supabase.rpc).mockImplementationOnce(()=>new Promise(r=>{reply=r;}) as never);
 await act(async()=>root.render(<Probe/>));auth.user={id:'viewer-b'};
 vi.mocked(supabase.rpc).mockResolvedValue({data:[],error:null} as never);
 await act(async()=>root.render(<Probe/>));
 await act(async()=>reply({data:[person],error:null}));expect(host.textContent).toBe('');
});

it('clears native background data even when WebView visibility stays visible',async()=>{
 await act(async()=>root.render(<Probe/>));expect(host.textContent).toBe('owner-private');
 await act(async()=>window.dispatchEvent(new CustomEvent(SHARING_APP_ACTIVE,{detail:false})));expect(host.textContent).toBe('');
 await act(async()=>vi.advanceTimersByTime(ACCESS_REFRESH_MS));expect(host.textContent).toBe('');
 await act(async()=>window.dispatchEvent(new CustomEvent(SHARING_APP_ACTIVE,{detail:true})));expect(host.textContent).toBe('owner-private');
});
