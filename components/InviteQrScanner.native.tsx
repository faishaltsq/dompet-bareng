import React, { useEffect, useRef, useState } from 'react'
import { View, Text, AppState, ActivityIndicator, Linking } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useLanguage } from '../context/LanguageContext'
import { parseInviteInput } from '../lib/inviteLinks'
import { InviteButton, inviteStyles as s } from './InviteControls'
import type { InviteQrScannerProps } from './InviteQrScanner'

export default function InviteQrScanner({active,onResult,onManualEntry}:InviteQrScannerProps) {
 const {t}=useLanguage()
 const [permission,requestPermission]=useCameraPermissions()
 const [foreground,setForeground]=useState(AppState.currentState!=='background'&&AppState.currentState!=='inactive')
 const [failed,setFailed]=useState(false)
 const [invalid,setInvalid]=useState(false)
 const [cameraKey,setCameraKey]=useState(0)
 const locked=useRef(false)
 const activeRef=useRef(active)
 const foregroundRef=useRef(foreground)
 activeRef.current=active
 useEffect(()=>{
  activeRef.current=active
  locked.current=false
  foregroundRef.current=active&&AppState.currentState!=='background'&&AppState.currentState!=='inactive'
  setForeground(foregroundRef.current)
  if(!active)return
  const sub=AppState.addEventListener('change',state=>{foregroundRef.current=state==='active';setForeground(foregroundRef.current);if(state!=='active')locked.current=false})
  return()=>{activeRef.current=false;sub.remove()}
 },[active])
 const scanning=active&&foreground&&permission?.granted&&!failed
 return <View style={{gap:14}}>
  <Text style={s.body}>{t('scanInviteExplain')}</Text>
  {!permission&&active&&<ActivityIndicator accessibilityLabel={t('joinLoading')}/>}
  {active&&permission&&!permission.granted&&<>
   <Text style={s.body}>{t('scanInviteDenied')}</Text>
   <InviteButton testID="camera-permission" label={t(permission.canAskAgain?'scanInvitePermission':'scanInviteSettings')} onPress={async()=>{try{if(permission.canAskAgain)await requestPermission();else await Linking.openSettings()}catch{setFailed(true)}}}/>
  </>}
  {scanning&&<CameraView key={cameraKey} testID="invite-camera-preview" style={{height:300,borderRadius:20,overflow:'hidden'}} facing="back" barcodeScannerSettings={{barcodeTypes:['qr']}}
   onMountError={()=>setFailed(true)} onBarcodeScanned={event=>{
    if(locked.current||!activeRef.current||!foregroundRef.current||event.type!=='qr')return
    const invite=parseInviteInput(event.data,'link')
    if(!invite){setInvalid(true);return}
    locked.current=true;setInvalid(false);onResult(invite.token)
   }}/>} 
  {invalid&&<Text accessibilityRole="alert" style={s.error}>{t('scanInviteInvalid')}</Text>}
  {failed&&<><Text accessibilityRole="alert" style={s.error}>{t('scanInviteUnavailable')}</Text><InviteButton outline label={t('scanInviteRetry')} onPress={()=>{setFailed(false);locked.current=false;setCameraKey(k=>k+1)}}/></>}
  <InviteButton testID="camera-manual-entry" outline label={t('scanInviteManual')} onPress={onManualEntry}/>
 </View>
}
