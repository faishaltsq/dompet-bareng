import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native'
import { useIsFocused } from 'expo-router'
import QRCode from 'react-native-qrcode-svg'
import SwipeableModal from './SwipeableModal'
import { InviteButton, inviteStyles as s } from './InviteControls'
import { useLanguage } from '../context/LanguageContext'
import { useWorkspaceQr } from '../hooks/useWorkspaceQr'
import { buildInviteUrl } from '../lib/inviteLinks'
import { inviteErrorKey } from '../lib/inviteCopy'

type Props={visible:boolean;workspaceId:string;walletName:string;onClose:()=>void;onShareLink:(link:string)=>void}
export function WorkspaceQrPanel({visible,workspaceId,walletName,onClose,onShareLink}:Props) {
 const {t}=useLanguage()
 const focused=useIsFocused()
 const qr=useWorkspaceQr(workspaceId,visible&&focused)
 const {width}=useWindowDimensions()
 const [confirm,setConfirm]=useState<'reset'|'disable'|null>(null)
 useEffect(()=>{setConfirm(null)},[workspaceId,visible])
 const url=qr.state?.state==='active'?buildInviteUrl(qr.state.invite.token):null
 return <SwipeableModal visible={visible} onClose={onClose} contentStyle={{paddingHorizontal:0,flexShrink:1}}>
  <ScrollView contentContainerStyle={s.content}>
   <Text accessibilityRole="header" style={s.title}>{t('walletQrTitle')}</Text>
   <Text style={s.subtitle}>{walletName}</Text>
   <Text style={s.body}>{t('walletQrExplain')}</Text>
   {qr.loading&&<ActivityIndicator accessibilityLabel={t('joinLoading')}/>}
   {qr.error&&<Text accessibilityRole="alert" style={s.error}>{t(inviteErrorKey(qr.error))}</Text>}
   {url&&<>
    <View style={{alignSelf:'center',backgroundColor:'#FFFFFF',padding:8,borderRadius:12}} accessibilityLabel={t('walletQrTitle')}>
     <QRCode value={url} size={Math.max(128,Math.min(224,width-112))} color="#000000" backgroundColor="#FFFFFF" quietZone={32} ecl="M"/>
    </View>
    <Text testID="qr-value" style={s.body} selectable>{url}</Text>
    <InviteButton testID="qr-share-link" label={t('walletQrShare')} onPress={()=>onShareLink(url)} disabled={qr.loading}/>
   </>}
   {qr.state?.state==='disabled'&&<><Text style={s.body}>{t('walletQrDisabled')}</Text><InviteButton testID="qr-enable" label={t('walletQrEnable')} onPress={()=>qr.action('enable')} disabled={qr.loading}/></>}
   {url&&!confirm&&<>
    <InviteButton testID="qr-reset" outline label={t('walletQrReset')} onPress={()=>setConfirm('reset')} disabled={qr.loading}/>
    <InviteButton testID="qr-disable" outline label={t('walletQrDisable')} onPress={()=>setConfirm('disable')} disabled={qr.loading}/>
   </>}
   {confirm&&<View style={s.card}>
    <Text style={s.body}>{t(confirm==='reset'?'walletQrResetExplain':'walletQrDisableExplain')}</Text>
    <InviteButton testID="qr-confirm-action" label={t(confirm==='reset'?'walletQrReset':'walletQrDisable')} disabled={qr.loading} onPress={async()=>{await qr.action(confirm);setConfirm(null)}}/>
    <InviteButton outline label={t('cancel')} disabled={qr.loading} onPress={()=>setConfirm(null)}/>
   </View>}
   <InviteButton outline label={t('joinRequestRefresh')} onPress={qr.refresh} disabled={qr.loading}/>
   <InviteButton outline label={t('close')} onPress={onClose}/>
  </ScrollView>
 </SwipeableModal>
}
