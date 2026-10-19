import React from 'react'
import { expect, it, vi } from 'vitest'
import { renderInviteElement } from '../../test/inviteRenderHarness'
import { requestFixture } from '../../test/inviteFixtures'
vi.mock('react-native',()=>({View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:(v:unknown)=>v}}))
vi.mock('../../context/LanguageContext',()=>({useLanguage:()=>({t:(k:string)=>k})}))
const panel=await import('../../components/InviteAdmissionPanel').catch(()=>null)
it('renders pending with cancellation but no financial wallet activation',async()=>{
 expect(panel,'admission panel must exist').not.toBeNull()
 const openWallet=vi.fn()
 const admission={preview:{wallet_name:'Wallet A',wallet_image_url:null,kind:'static' as const,expires_at:null},state:{state:'request' as const,request:requestFixture()},loading:false,submitting:false,error:null,retryAt:null,registered:true,submit:vi.fn(),cancel:vi.fn(),refresh:vi.fn(),openWallet}
 const view=await renderInviteElement(React.createElement(panel!.InviteAdmissionPanel,{admission,accountLabel:'fixture@example.invalid',onLogin:vi.fn(),onScan:vi.fn()}))
 expect(view.renderer.root.findAllByProps({testID:'open-wallet'})).toHaveLength(0)
 expect(view.renderer.root.findByProps({testID:'join-pending'})).toBeTruthy()
 await view.press('cancel-join-request')
 expect(admission.cancel).toHaveBeenCalledTimes(1)
 expect(openWallet).not.toHaveBeenCalled()
 await view.unmount()
})
