import React from 'react'
import { expect, it, vi } from 'vitest'
import { renderInviteElement } from '../../test/inviteRenderHarness'
import { walletId, inviteToken } from '../../test/inviteFixtures'
const h=vi.hoisted(()=>({action:vi.fn(),close:vi.fn(),show:vi.fn()}))
vi.mock('react-native',()=>({View:'View',Text:'Text',ScrollView:'ScrollView',TouchableOpacity:'TouchableOpacity',ActivityIndicator:'ActivityIndicator',Image:'Image',StyleSheet:{create:(v:unknown)=>v},useWindowDimensions:()=>({width:360,height:800}),Platform:{OS:'android',select:()=>({})},Vibration:{vibrate:vi.fn()},Share:{share:vi.fn()},Linking:{openURL:vi.fn()}}))
vi.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}))
vi.mock('expo-router',()=>({useIsFocused:()=>true}))
vi.mock('../../context/LanguageContext',()=>({useLanguage:()=>({t:(key:string)=>key})}))
vi.mock('../../components/SwipeableModal',()=>({default:({visible,children}:any)=>visible?React.createElement('Modal',null,children):null}))
vi.mock('react-native-qrcode-svg',()=>({default:'QRCode'}))
vi.mock('../../hooks/useWorkspaceQr',()=>({useWorkspaceQr:()=>({state:{state:'active',invite:{token:'0123456789abcdef0123456789abcdef',kind:'static',expires_at:null}},loading:false,error:null,action:h.action,refresh:vi.fn()})}))
const qr=await import('../../components/WorkspaceQrPanel').catch(()=>null)
import InviteShareModal from '../../components/InviteShareModal'
it('shares static QR links without claiming seven-day expiry',async()=>{
 const view=await renderInviteElement(React.createElement(InviteShareModal,{visible:true,onClose:h.close,workspaceName:'Wallet A',inviteLink:`https://dompet-bareng.vercel.app/invite/${inviteToken}`,inviteKind:'static'}))
 expect(JSON.stringify(view.renderer.toJSON())).toContain('walletQrShareNote')
 expect(JSON.stringify(view.renderer.toJSON())).not.toContain('inviteNote')
 await view.unmount()
})
it('renders a real local QR payload and requires reset confirmation',async()=>{
 expect(qr,'QR panel must exist').not.toBeNull()
 const view=await renderInviteElement(React.createElement(qr!.WorkspaceQrPanel,{visible:true,workspaceId:walletId,walletName:'Wallet A',onClose:h.close,onShareLink:vi.fn()}))
 const code=view.renderer.root.findByProps({value:`https://dompet-bareng.vercel.app/invite/${inviteToken}`})
 expect(code.props.value).toBe(`https://dompet-bareng.vercel.app/invite/${inviteToken}`)
 expect(code.props.backgroundColor).toBe('#FFFFFF')
 expect(code.props.quietZone).toBeGreaterThan(0)
 await view.press('qr-reset')
 expect(h.action).not.toHaveBeenCalled()
 await view.press('qr-confirm-action')
 expect(h.action).toHaveBeenCalledWith('reset')
 await view.unmount()
})
