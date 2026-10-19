import { beforeEach, expect, it, vi } from 'vitest'
const { values, platform } = vi.hoisted(() => ({ values: new Map<string,string>(), platform:{OS:'android'} }))
vi.mock('react-native',()=>({Platform:platform}))
vi.mock('@react-native-async-storage/async-storage',()=>({default:{getItem:async(k:string)=>values.get(k)??null,setItem:async(k:string,v:string)=>{values.set(k,v)},removeItem:async(k:string)=>{values.delete(k)}}}))
const intent=await import('../pendingInvite').catch(()=>null)
const token='0123456789abcdef0123456789abcdef'
beforeEach(()=>values.clear())
it('retains a validated invitation only for 24 hours',async()=>{
 expect(intent,'Pending intent API must exist').not.toBeNull()
 const now=Date.parse('2026-10-19T09:00:00+07:00')
 await intent!.savePendingInvite(token,now)
 expect(await intent!.readPendingInvite(now+1000)).toEqual({token,savedAt:now})
 expect(await intent!.readPendingInvite(now+24*60*60*1000)).toBeNull()
})
