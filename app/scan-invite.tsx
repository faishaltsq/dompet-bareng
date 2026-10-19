import React, { useRef, useState } from 'react'
import { View, ScrollView, TextInput, Text, Platform, Keyboard } from 'react-native'
import { useRouter, useIsFocused } from 'expo-router'
import { useLanguage } from '@/context/LanguageContext'
import { parseInviteInput } from '@/lib/inviteLinks'
import { InviteButton, inviteStyles as s } from '@/components/InviteControls'
import InviteQrScanner from '@/components/InviteQrScanner'

export default function ScanInviteScreen() {
 const {t}=useLanguage()
 const router=useRouter()
 const focused=useIsFocused()
 const inputRef=useRef<TextInput>(null)
 const [manual,setManual]=useState(Platform.OS==='web')
 const [input,setInput]=useState('')
 const [error,setError]=useState(false)
 const open=()=>{const parsed=parseInviteInput(input,'manual');if(!parsed){setError(true);return}Keyboard.dismiss();router.push({pathname:'/invite/[token]',params:parsed})}
 return <View style={s.root}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
  <InviteQrScanner active={focused&&!manual} onResult={token=>router.push({pathname:'/invite/[token]',params:{token}})} onManualEntry={()=>{setManual(true);inputRef.current?.focus()}}/>
  {Platform.OS!=='web'&&manual&&<InviteButton outline label={t('scanInviteRetry')} onPress={()=>{Keyboard.dismiss();setManual(false)}}/>}
  <Text accessibilityRole="header" style={s.title}>{t('scanInviteManual')}</Text>
  <TextInput ref={inputRef} testID="manual-invite-input" accessibilityLabel={t('scanInviteManual')} style={s.input} value={input} onChangeText={value=>{setInput(value);setError(false)}} onFocus={()=>setManual(true)} autoCapitalize="none" autoCorrect={false} placeholder={t('scanInviteManual')} onSubmitEditing={open}/>
  {error&&<Text accessibilityRole="alert" style={s.error}>{t('scanInviteInvalid')}</Text>}
  <InviteButton testID="open-manual-invite" label={t('inviteTitle')} onPress={open}/>
 </ScrollView></View>
}
