import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { rpc } }))
const service = await import('../workspaceInvites').catch(() => null)
const token = '0123456789abcdef0123456789abcdef'
beforeEach(() => { rpc.mockReset() })
afterEach(() => vi.useRealTimers())
it('submits only a token and retry intent, never a user or role', async () => {
  expect(service, 'Admission RPC service must exist').not.toBeNull()
  rpc.mockResolvedValue({ data: { ok: true, value: { state: 'available' } }, error: null })
  expect(await service!.submitWorkspaceJoinRequest(token)).toEqual({ ok: true, value: { state: 'available' } })
  expect(rpc).toHaveBeenCalledWith('submit_workspace_join_request', { p_token: token, p_retry: false })
})
it('times out a stalled RPC instead of leaving a permanent spinner',async()=>{
 vi.useFakeTimers()
 rpc.mockReturnValue(new Promise(()=>{}))
 let settled=false
 const result=service!.previewWorkspaceInvite(token).then(reply=>{settled=true;return reply})
 await vi.advanceTimersByTimeAsync(15000)
 expect(settled).toBe(true)
 expect(await result).toEqual({ok:false,code:'network_error'})
})
it('reports a server that has not deployed admission RPCs as disabled',async()=>{
 rpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'private server details'}})
 expect(await service!.previewWorkspaceInvite(token)).toEqual({ok:false,code:'feature_disabled'})
})
