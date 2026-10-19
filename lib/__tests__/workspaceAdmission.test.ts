import React, { act } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { renderHookProbe } from '../../test/inviteRenderHarness'
const h=vi.hoisted(()=>({user:{id:'20000000-0000-4000-8000-000000000004'},next:null as Promise<unknown>|null,rows:[] as unknown[],inserts:vi.fn(),temporary:vi.fn()}))
vi.mock('react-native',()=>({Platform:{OS:'android'},Share:{},Alert:{alert:vi.fn()},AppState:{addEventListener:()=>({remove(){}})}}))
vi.mock('@react-native-async-storage/async-storage',()=>({default:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}}}))
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:h.user,profile:null})}))
vi.mock('../workspaceInvites',()=>({createTemporaryInvite:h.temporary}))
vi.mock('../supabase',()=>({supabase:{from:(table:string)=>{
 const q:any={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,range:()=>q,insert:(v:unknown)=>{h.inserts(v);return q},then:(ok:any,no:any)=>{const value=table==='workspace_members'?(h.next??Promise.resolve({data:h.rows,error:null})):Promise.resolve({data:[],error:null});h.next=null;return Promise.resolve(value).then(ok,no)}};return q
},channel:()=>{const c:any={on:()=>c,subscribe:()=>c};return c},removeChannel:vi.fn()}}))
import { useWorkspace, WorkspaceProvider } from '../../context/WorkspaceContext'
const walletId='10000000-0000-4000-8000-000000000001'
const joined=[{role:'member',workspaces:{id:walletId,name:'Wallet A',image_url:null}}]
beforeEach(()=>{h.user={id:'20000000-0000-4000-8000-000000000004'};h.rows=[];h.next=null;h.inserts.mockReset()})
it('does not activate a wallet without fresh membership',async()=>{
 const p=await renderHookProbe(useWorkspace,WorkspaceProvider)
 expect(typeof p.read().openJoinedWorkspace,'authoritative activation API').toBe('function')
 let opened:boolean|undefined
 await act(async()=>{opened=await p.read().openJoinedWorkspace(walletId)})
 expect(opened).toBe(false)
 expect(p.read().activeWorkspace).toBeNull()
 expect(h.inserts).not.toHaveBeenCalled()
 await p.unmount()
})
it('opens exactly the authorized wallet without writing membership',async()=>{
 const p=await renderHookProbe(useWorkspace,WorkspaceProvider)
 h.rows=joined
 let opened:boolean|undefined
 await act(async()=>{opened=await p.read().openJoinedWorkspace(walletId)})
 expect(opened).toBe(true)
 expect(p.read().activeWorkspace?.id).toBe(walletId)
 expect(h.inserts).not.toHaveBeenCalled()
 await p.unmount()
})
it('discards membership that resolves after an account change',async()=>{
 const p=await renderHookProbe(useWorkspace,WorkspaceProvider)
 let resolve!:(value:unknown)=>void
 h.next=new Promise(r=>{resolve=r})
 let opening!:Promise<boolean>
 await act(async()=>{opening=p.read().openJoinedWorkspace(walletId)})
 h.user={id:'20000000-0000-4000-8000-000000000005'}
 await p.rerender(useWorkspace)
 await act(async()=>{resolve({data:joined,error:null});expect(await opening).toBe(false)})
 expect(p.read().activeWorkspace?.id).not.toBe(walletId)
 await p.unmount()
})
it('does not switch a wallet when the waiting screen blurred during activation',async()=>{
 const p=await renderHookProbe(useWorkspace,WorkspaceProvider)
 h.rows=joined
 let opened:boolean|undefined
 await act(async()=>{opened=await p.read().openJoinedWorkspace(walletId,()=>false)})
 expect(opened).toBe(false)
 expect(p.read().activeWorkspace).toBeNull()
 await p.unmount()
})
