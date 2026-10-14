import { expect, it, vi } from 'vitest';
import { invitationDeliveryText } from './invitationDelivery';
import { sendEmail } from './client';
import { supabase } from '../supabase';
vi.mock('../supabase',()=>({supabase:{functions:{invoke:vi.fn()}}}));
it('sends only a share id and kind, never client-selected recipient or health content',async()=>{
 vi.mocked(supabase.functions.invoke).mockResolvedValue({data:{sent:true},error:null} as never);
 expect((await sendEmail({kind:'care_invite',share_id:'share-id'})).sent).toBe(true);
 expect(supabase.functions.invoke).toHaveBeenCalledWith('send-email',{body:{kind:'care_invite',share_id:'share-id'}});
});
it('preserves a manual handoff and retry for failures without claiming delivery',async()=>{
 vi.mocked(supabase.functions.invoke).mockRejectedValueOnce(new Error('offline'));
 const r=await sendEmail({kind:'care_invite',share_id:'share-id'});
 expect(r.sent).toBe(false);expect(invitationDeliveryText('person@example.test',r)).toContain('Invitation saved, but');
 expect(invitationDeliveryText('person@example.test',r)).toContain('Following');
});
it('distinguishes provider acceptance from inbox delivery',()=>{
 expect(invitationDeliveryText('person@example.test',{ok:true,sent:true,deferred:false})).toContain('inbox delivery is not confirmed');
});
