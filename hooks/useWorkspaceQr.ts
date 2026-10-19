import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { manageWorkspaceQr } from '../lib/workspaceInvites'
import type { StaticQrState, QrAction, InviteErrorCode } from '../lib/inviteTypes'

type Tag={key:string;enabled:boolean}
export function useWorkspaceQr(workspaceId:string|null,enabled:boolean) {
 const {user}=useAuth()
 const key=`${user?.id??''}:${workspaceId}`
 const tagRef=useRef<Tag>({key,enabled})
 if(tagRef.current.key!==key||tagRef.current.enabled!==enabled)tagRef.current={key,enabled}
 const [frame,setFrame]=useState<{tag:Tag;state:StaticQrState|null;loading:boolean;error:InviteErrorCode|null}|null>(null)
 const job=useRef<Tag|null>(null)
 const action=useCallback(async(action:QrAction)=>{
  const tag=tagRef.current
  if(!enabled||!workspaceId||!user?.id||tag.key!==key||job.current===tag)return
  job.current=tag
  setFrame(previous=>({tag,state:previous?.tag===tag?previous.state:null,loading:true,error:null}))
  try {
   const result=await manageWorkspaceQr(workspaceId,action)
   if(tagRef.current!==tag)return
   if(result.ok)setFrame({tag,state:result.value,loading:false,error:null})
   else setFrame(previous=>({tag,state:result.code==='network_error'&&previous?.tag===tag?previous.state:null,loading:false,error:result.code}))
  }catch{if(tagRef.current===tag)setFrame(previous=>({tag,state:previous?.tag===tag?previous.state:null,loading:false,error:'network_error'}))}
  finally{if(job.current===tag)job.current=null}
 },[key,enabled,workspaceId,user?.id])
 useEffect(()=>{void action('get');return()=>{if(tagRef.current.key===key)tagRef.current={key,enabled:false}}},[action])
 const visible=frame?.tag===tagRef.current?frame:null
 return {state:visible?.state??null,loading:visible?.loading??Boolean(enabled&&user?.id&&workspaceId),error:visible?.error??null,action,refresh:()=>action('get')}
}
