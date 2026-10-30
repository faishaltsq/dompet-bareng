import React from 'react'
import { create, act, type ReactTestRenderer } from 'react-test-renderer'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
export type HookProbe<T> = { read(): T; rerender(hook:()=>T):Promise<void>; unmount():Promise<void> }
export async function renderHookProbe<T>(hook:()=>T, wrapper?:React.ComponentType<{children:React.ReactNode}>):Promise<HookProbe<T>> {
 let currentHook=hook
 let value:T
 let renderer:ReactTestRenderer
 function Probe(){ value=currentHook(); return null }
 const element=()=>wrapper?React.createElement(wrapper,{children:React.createElement(Probe)}):React.createElement(Probe)
 await act(async()=>{renderer=create(element())})
 return {read:()=>value,rerender:async(next)=>{currentHook=next;await act(async()=>{renderer.update(element())})},unmount:async()=>{await act(async()=>{renderer.unmount()})}}
}
export async function renderInviteElement(element:React.ReactElement) {
 let renderer!:ReactTestRenderer
 await act(async()=>{renderer=create(element)})
 return {renderer,press:async(testID:string)=>{await act(async()=>{const n=renderer.root.findByProps({testID});if(!n.props.disabled)await n.props.onPress()})},unmount:async()=>{await act(async()=>renderer.unmount())}}
}
