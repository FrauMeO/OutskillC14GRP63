// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import AppointmentSummary from './AppointmentSummary';
import { supabase } from '../lib/supabase';
vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
let host: HTMLDivElement;let root: ReturnType<typeof createRoot>;
let response: {data: unknown[];error: object|null};let reject=false;
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true}); host=document.createElement('div');document.body.append(host);root=createRoot(host);
 response={data:[],error:{message:'network'}};reject=false;
 vi.mocked(supabase.from).mockImplementation(()=>{const q={select:()=>q,gte:()=>q,lte:()=>q,then:(ok: (x:unknown)=>unknown,bad: (x:unknown)=>unknown)=> reject ? Promise.reject(new Error('offline')).then(ok,bad):Promise.resolve(response).then(ok,bad)};return q as never;});
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const printButton=()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Print or save as PDF')!;
it('disables print after a load error; retry enables it only after successful fresh data',async()=>{
 await act(async()=>root.render(<AppointmentSummary/>));expect(printButton().disabled).toBe(true);
 expect(host.querySelector('article')).toBeNull();expect(host.querySelector('[role="alert"]')?.className).not.toContain('summary-no-print');
 response={data:[],error:null};await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Try again')!.click());
 expect(printButton().disabled).toBe(false);expect(host.querySelector('article')).not.toBeNull();
 expect(host.querySelectorAll('#questions-heading + p + ol li')).toHaveLength(3);
});
it('handles rejected network requests without producing an empty printable report',async()=>{
 reject=true;await act(async()=>root.render(<AppointmentSummary/>));expect(printButton().disabled).toBe(true);expect(host.textContent).toContain('Try again');
});
it('keeps concerns out of the printable report unless the owner opts in',async()=>{
 response={data:[],error:null};await act(async()=>root.render(<AppointmentSummary/>));
 const box=host.querySelector('input[type="checkbox"]') as HTMLInputElement;expect(box.checked).toBe(false);
 expect(host.querySelector('textarea')?.closest('section')?.className).toContain('summary-no-print');
});
