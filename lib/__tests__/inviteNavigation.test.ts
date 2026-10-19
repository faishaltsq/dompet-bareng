import { beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { renderHookProbe } from '../../test/inviteRenderHarness'
const h=vi.hoisted(()=>({push:vi.fn(),listener:null as null|((e:{url:string})=>void),remove:vi.fn(),initial:vi.fn(),exchange:vi.fn(),session:vi.fn()}))
vi.mock('expo-router',()=>({useRouter:()=>({push:h.push})}))
vi.mock('expo-linking',()=>({getInitialURL:h.initial,addEventListener:(_event:string,listener:any)=>{h.listener=listener;return{remove:h.remove}}}))
vi.mock('react-native',()=>({Platform:{OS:'android'}}))
vi.mock('../supabase',()=>({supabase:{auth:{exchangeCodeForSession:h.exchange,setSession:h.session}}}))
const nav=await import('../../hooks/useInviteNavigation').catch(()=>null)
const token='0123456789abcdef0123456789abcdef'
beforeEach(()=>{vi.clearAllMocks();h.initial.mockResolvedValue(`dompetbareng://invite/${token}`)})
it('handles a native custom-scheme cold start only after router readiness',async()=>{
 expect(nav,'navigation hook must exist').not.toBeNull()
 const p=await renderHookProbe(()=>nav!.useInviteNavigation(false))
 expect(h.push).not.toHaveBeenCalled()
 await p.rerender(()=>nav!.useInviteNavigation(true))
 expect(h.push).toHaveBeenCalledWith({pathname:'/invite/[token]',params:{token}})
 await act(async()=>h.listener?.({url:`dompetbareng://invite/${token}`}))
 expect(h.push).toHaveBeenCalledTimes(1)
 await p.unmount()
 expect(h.remove).toHaveBeenCalled()
})
