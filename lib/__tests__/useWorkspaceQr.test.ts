import { act } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { renderHookProbe } from '../../test/inviteRenderHarness'
import { walletId, inviteToken } from '../../test/inviteFixtures'
const h=vi.hoisted(()=>({manage:vi.fn(),user:{id:'20000000-0000-4000-8000-000000000001'}}))
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:h.user})}))
vi.mock('../workspaceInvites',()=>({manageWorkspaceQr:h.manage}))
const hook=await import('../../hooks/useWorkspaceQr').catch(()=>null)
beforeEach(()=>{vi.resetAllMocks();h.manage.mockResolvedValue({ok:true,value:{state:'disabled'}})})
it('keeps disabled state on reopening and only enables explicitly',async()=>{
 expect(hook,'QR state hook must exist').not.toBeNull()
 const p=await renderHookProbe(()=>hook!.useWorkspaceQr(walletId,true))
 expect(h.manage).toHaveBeenCalledWith(walletId,'get')
 expect(p.read().state).toEqual({state:'disabled'})
 h.manage.mockResolvedValue({ok:true,value:{state:'active',invite:{token:inviteToken,kind:'static',expires_at:null}}})
 await act(async()=>{await p.read().action('enable')})
 expect(h.manage).toHaveBeenLastCalledWith(walletId,'enable')
 expect(p.read().state?.state).toBe('active')
 await p.unmount()
})
