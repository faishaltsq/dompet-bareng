import React, { act } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { renderInviteElement } from '../../test/inviteRenderHarness'
import { inviteToken } from '../../test/inviteFixtures'
const h=vi.hoisted(()=>({permission:{granted:true,canAskAgain:true},request:vi.fn(),listeners:new Set<(s:string)=>void>(),settings:vi.fn()}))
vi.mock('expo-camera',()=>({CameraView:'CameraView',useCameraPermissions:()=>[h.permission,h.request]}))
vi.mock('react-native',()=>({View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:(v:unknown)=>v},Linking:{openSettings:h.settings},AppState:{currentState:'active',addEventListener:(_e:string,f:(s:string)=>void)=>{h.listeners.add(f);return{remove:()=>h.listeners.delete(f)}}}}))
vi.mock('../../context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>key})}))
const scanner=await import('../../components/InviteQrScanner.native').catch(()=>null)
beforeEach(()=>{vi.clearAllMocks();h.listeners.clear();h.permission={granted:true,canAskAgain:true}})
it('accepts one valid QR frame and never opens a browser',async()=>{
 expect(scanner,'native QR scanner must exist').not.toBeNull()
 const onResult=vi.fn()
 const view=await renderInviteElement(React.createElement(scanner!.default,{active:true,onResult,onManualEntry:vi.fn()}))
 const camera=view.renderer.root.findByProps({testID:'invite-camera-preview'})
 await act(async()=>{camera.props.onBarcodeScanned({type:'qr',data:`https://dompet-bareng.vercel.app/invite/${inviteToken}`});camera.props.onBarcodeScanned({type:'qr',data:`https://dompet-bareng.vercel.app/invite/${inviteToken}`})})
 expect(onResult).toHaveBeenCalledTimes(1)
 expect(onResult).toHaveBeenCalledWith(inviteToken)
 await act(async()=>{for(const f of h.listeners)f('background')})
 expect(view.renderer.root.findAllByProps({testID:'invite-camera-preview'})).toHaveLength(0)
 await view.unmount()
 expect(h.listeners.size).toBe(0)
})
it('ignores a queued camera frame immediately after backgrounding',async()=>{
 const onResult=vi.fn()
 const view=await renderInviteElement(React.createElement(scanner!.default,{active:true,onResult,onManualEntry:vi.fn()}))
 const camera=view.renderer.root.findByProps({testID:'invite-camera-preview'})
 await act(async()=>{
  for(const f of h.listeners)f('background')
  camera.props.onBarcodeScanned({type:'qr',data:`https://dompet-bareng.vercel.app/invite/${inviteToken}`})
 })
 expect(onResult).not.toHaveBeenCalled()
 await view.unmount()
})
it('keeps the camera callback working after strict effect replay',async()=>{
 const onResult=vi.fn()
 const view=await renderInviteElement(React.createElement(React.StrictMode,null,React.createElement(scanner!.default,{active:true,onResult,onManualEntry:vi.fn()})))
 const camera=view.renderer.root.findByProps({testID:'invite-camera-preview'})
 await act(async()=>camera.props.onBarcodeScanned({type:'qr',data:`https://dompet-bareng.vercel.app/invite/${inviteToken}`}))
 expect(onResult).toHaveBeenCalledTimes(1)
 await view.unmount()
})
