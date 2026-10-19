import { act } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { renderHookProbe } from '../../test/inviteRenderHarness'
import { requestFixture, inviteToken } from '../../test/inviteFixtures'
const h=vi.hoisted(()=>({preview:vi.fn(),state:vi.fn(),submit:vi.fn(),cancel:vi.fn(),my:vi.fn(),open:vi.fn(),replace:vi.fn(),clear:vi.fn()}))
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{id:'20000000-0000-4000-8000-000000000004',email:'fixture@example.invalid',is_anonymous:false}})}))
vi.mock('../../context/WorkspaceContext',()=>({useWorkspace:()=>({openJoinedWorkspace:h.open})}))
vi.mock('expo-router',()=>({useRouter:()=>({replace:h.replace})}))
vi.mock('react-native',()=>({AppState:{currentState:'active',addEventListener:()=>({remove(){}})}}))
vi.mock('../pendingInvite',()=>({clearPendingInvite:h.clear}))
vi.mock('../workspaceInvites',()=>({previewWorkspaceInvite:h.preview,getWorkspaceJoinState:h.state,submitWorkspaceJoinRequest:h.submit,cancelWorkspaceJoinRequest:h.cancel,listMyJoinRequests:h.my}))
vi.mock('../supabase',()=>({supabase:{channel:()=>{const c:any={on:()=>c,subscribe:()=>c};return c},removeChannel:vi.fn()}}))
const hook=await import('../../hooks/useInviteAdmission').catch(()=>null)
beforeEach(()=>{
 vi.resetAllMocks()
 h.preview.mockResolvedValue({ok:true,value:{wallet_name:'Wallet A',wallet_image_url:null,kind:'static',expires_at:null}})
 h.state.mockResolvedValue({ok:true,value:{state:'available'}})
 h.my.mockResolvedValue({ok:true,value:{items:[],pending_count:0,next_cursor:null}})
 h.submit.mockImplementation(async()=>{
  const result={ok:true,value:{state:'request',request:requestFixture()}}
  h.state.mockResolvedValue(result)
  return result
 })
 h.open.mockResolvedValue(true)
 h.clear.mockResolvedValue(undefined)
})
it('submits once and waits without treating pending as membership',async()=>{
 expect(hook,'admission hook must exist').not.toBeNull()
 const p=await renderHookProbe(()=>hook!.useInviteAdmission(inviteToken,true))
 await act(async()=>{await Promise.all([p.read().submit(),p.read().submit()])})
 expect(h.submit).toHaveBeenCalledTimes(1)
 expect(h.submit).toHaveBeenCalledWith(inviteToken,false)
 expect(p.read().state?.state).toBe('request')
 expect(h.open).not.toHaveBeenCalled()
 expect(h.replace).not.toHaveBeenCalled()
 await p.unmount()
})
