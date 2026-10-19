import React, { act } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { renderHookProbe } from '../../test/inviteRenderHarness'
const h=vi.hoisted(()=>({user:{id:'20000000-0000-4000-8000-000000000004'},my:vi.fn(),admin:vi.fn(),decide:vi.fn(),cancel:vi.fn(),remove:vi.fn(),event:null as null|(()=>void),app:null as null|((s:string)=>void)}))
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:h.user})}))
vi.mock('react-native',()=>({AppState:{currentState:'active',addEventListener:(_e:string,f:any)=>{h.app=f;return{remove:vi.fn()}}}}))
vi.mock('../workspaceInvites',()=>({listMyJoinRequests:h.my,listWorkspaceJoinRequests:h.admin,decideWorkspaceJoinRequest:h.decide,cancelWorkspaceJoinRequest:h.cancel}))
vi.mock('../supabase',()=>({supabase:{channel:()=>{const c:any={on:(_e:any,_f:any,fn:any)=>{h.event=fn;return c},subscribe:()=>c};return c},removeChannel:h.remove}}))
const hook=await import('../../hooks/useJoinRequests').catch(()=>null)
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();h.user={id:'20000000-0000-4000-8000-000000000004'};h.my.mockResolvedValue({ok:true,value:{items:[],pending_count:0,next_cursor:null}});h.admin.mockResolvedValue({ok:true,value:{items:[],pending_count:0,next_cursor:null}})})
afterEach(()=>vi.useRealTimers())
it('polls only while enabled and cleans its subscription',async()=>{
 expect(hook,'request-list hook must exist').not.toBeNull()
 const p=await renderHookProbe(()=>hook!.useJoinRequests({type:'mine'},true))
 expect(h.my).toHaveBeenCalledTimes(1)
 await act(async()=>{await vi.advanceTimersByTimeAsync(15000)})
 expect(h.my).toHaveBeenCalledTimes(2)
 await p.rerender(()=>hook!.useJoinRequests({type:'mine'},false))
 await act(async()=>{await vi.advanceTimersByTimeAsync(30000)})
 expect(h.my).toHaveBeenCalledTimes(2)
 expect(h.remove).toHaveBeenCalled()
 await p.unmount()
})
it('recovers after React strict effect cleanup and replay',async()=>{
 const wrapper=({children}:{children:React.ReactNode})=>React.createElement(React.StrictMode,null,children)
 const p=await renderHookProbe(()=>hook!.useJoinRequests({type:'mine'},true),wrapper)
 expect(p.read().loading).toBe(false)
 const before=h.my.mock.calls.length
 await act(async()=>{await vi.advanceTimersByTimeAsync(15000)})
 expect(h.my.mock.calls.length).toBe(before+1)
 await p.unmount()
})
