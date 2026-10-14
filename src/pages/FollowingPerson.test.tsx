// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import FollowingPerson from './FollowingPerson';
import { supabase } from '../lib/supabase';
const control=vi.hoisted(()=>({people:[] as unknown[],loading:false,failed:null,revision:1,reload:vi.fn()}));
vi.mock('../lib/useFollowedPeople',()=>({useFollowedPeople:()=>control}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:vi.fn()}}));
vi.mock('react-router-dom',()=>({useParams:()=>({ownerId:'owner'}),Link:({children}:{children:React.ReactNode})=><span>{children}</span>}));
vi.mock('../components/CaregiverPlanCard',()=>({default:()=>null}));
vi.mock('../components/SharedLevelView',()=>({default:({days}:{days:{sleep_hours:number}[]})=><div>{days.map(d=>`PRIVATE-SLEEP-${d.sleep_hours}`).join(',')}</div>}));
let host:HTMLDivElement;let root:ReturnType<typeof createRoot>;
const person={owner_id:'owner',owner_name:'Owner',status:'active',level:'detail',paused:false,share_sleep:true,share_eat:false,share_move:false,share_balance:false};
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');root=createRoot(host);control.people=[person];control.loading=false;control.revision=1;vi.mocked(supabase.rpc).mockReset();vi.mocked(supabase.rpc).mockImplementation((name)=>Promise.resolve({data:name==='shared_days'?[{sleep_hours:7}]:[],error:null}) as never);});
afterEach(async()=>{await act(async()=>root.unmount());});
it('clears mounted values after pause and does not restore a stale pending response',async()=>{
 await act(async()=>root.render(<FollowingPerson/>));expect(host.textContent).toContain('PRIVATE-SLEEP-7');
 control.people=[{...person,paused:true}];control.revision++;
 await act(async()=>root.render(<FollowingPerson/>));expect(host.textContent).not.toContain('PRIVATE-SLEEP');expect(host.textContent).toContain('paused');
});
it('cancels data reads when a newer access check revokes the share',async()=>{
 let complete!:(x:unknown)=>void;vi.mocked(supabase.rpc).mockImplementation((name)=>name==='shared_days'?new Promise(r=>{complete=r;}) as never:Promise.resolve({data:[],error:null}) as never);
 await act(async()=>root.render(<FollowingPerson/>));control.people=[];control.revision++;
 await act(async()=>root.render(<FollowingPerson/>));await act(async()=>complete({data:[{sleep_hours:7}],error:null}));expect(host.textContent).not.toContain('PRIVATE-SLEEP');
});
it('never renders cached details during a scope downgrade',async()=>{
 await act(async()=>root.render(<FollowingPerson/>));expect(host.textContent).toContain('PRIVATE-SLEEP-7');
 vi.mocked(supabase.rpc).mockImplementation(()=>new Promise(()=>{}) as never);
 control.people=[{...person,level:'presence'}];control.revision++;
 await act(async()=>root.render(<FollowingPerson/>));expect(host.textContent).not.toContain('PRIVATE-SLEEP');
});
