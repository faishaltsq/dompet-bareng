import React, { useRef, useState } from 'react'
import { View, ScrollView, Text, Platform, Linking } from 'react-native'
import { useLocalSearchParams, useRouter, useIsFocused } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { useInviteAdmission } from '@/hooks/useInviteAdmission'
import { parseInviteInput } from '@/lib/inviteLinks'
import { savePendingInvite, clearPendingInvite } from '@/lib/pendingInvite'
import { InviteAdmissionPanel } from '@/components/InviteAdmissionPanel'
import { InviteButton, inviteStyles as s } from '@/components/InviteControls'

export default function JoinWorkspaceScreen() {
 const {token:raw}=useLocalSearchParams<{token:string}>()
 const pathToken=typeof window!=='undefined'?/^\/invite\/([0-9a-f]{32})$/.exec(window.location.pathname)?.[1]:null
 const token=parseInviteInput(typeof raw==='string'?raw:'','manual')?.token ?? parseInviteInput(pathToken??'','manual')?.token ?? null
 const router=useRouter()
 const focused=useIsFocused()
 const insets=useSafeAreaInsets()
 const {user,signInWithGoogle}=useAuth()
 const {t}=useLanguage()
 const admission=useInviteAdmission(token,focused)
 const [loggingIn,setLoggingIn]=useState(false)
 const [loginError,setLoginError]=useState(false)
 const loginLock=useRef(false)
 const login=async()=>{
  if(!token||loginLock.current)return
  loginLock.current=true;setLoggingIn(true);setLoginError(false)
  try{await savePendingInvite(token);await signInWithGoogle()}
  catch{setLoginError(true)}finally{loginLock.current=false;setLoggingIn(false)}
 }
 const close=async()=>{await clearPendingInvite();router.replace('/(tabs)')}
 return <View style={s.root}><ScrollView contentContainerStyle={[s.content,{paddingBottom:insets.bottom+24,maxWidth:620,width:'100%',alignSelf:'center'}]}>
  <InviteAdmissionPanel admission={{...admission,submitting:admission.submitting||loggingIn}} accountLabel={user?.email??''} onLogin={login} onScan={()=>router.push('/scan-invite')} />
  {loginError&&<Text accessibilityRole="alert" style={s.error}>{t('alertGoogleLoginFailed')}</Text>}
  {Platform.OS==='web'&&token&&<>
   <InviteButton outline label={t('inviteBtnOpenApp')} onPress={async()=>{try{await Linking.openURL(`dompetbareng://invite/${token}`)}catch{setLoginError(true)}}} />
   <InviteButton outline label={t('downloadAndroidApp')} onPress={()=>router.push('/download')} />
  </>}
  <InviteButton outline label={t('myJoinRequests')} onPress={()=>router.push('/join-requests')} />
  <InviteButton outline label={t('inviteBackToHome')} onPress={close} />
 </ScrollView></View>
}