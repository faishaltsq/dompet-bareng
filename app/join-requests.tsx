import React from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native'
import { useRouter, useIsFocused } from 'expo-router'
import { useLanguage } from '@/context/LanguageContext'
import { useWorkspace } from '@/context/WorkspaceContext'
import { useJoinRequests } from '@/hooks/useJoinRequests'
import { inviteErrorKey, joinStatusKeys } from '@/lib/inviteCopy'
import { InviteButton, inviteStyles as s } from '@/components/InviteControls'

export default function MyJoinRequestsScreen() {
 const focused=useIsFocused()
 const {t,language}=useLanguage()
 const {openJoinedWorkspace}=useWorkspace()
 const router=useRouter()
 const requests=useJoinRequests({type:'mine'},focused)
 return <View style={s.root}><ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={requests.loading} onRefresh={()=>{void requests.refresh()}}/>}>
  <Text accessibilityRole="header" style={s.title}>{t('myJoinRequests')}</Text>
  {requests.error&&<Text accessibilityRole="alert" style={s.error}>{t(inviteErrorKey(requests.error))}</Text>}
  {requests.loading&&<ActivityIndicator/>}
  {!requests.loading&&!requests.items.length&&<Text style={s.empty}>{t('joinRequestsEmpty')}</Text>}
  {requests.items.map(item=><View key={item.id} style={s.card}>
   <Text style={s.subtitle}>{item.wallet_name}</Text>
   <Text style={s.body}>{t(joinStatusKeys[item.status])}</Text>
   <Text style={s.body}>{new Date(item.created_at).toLocaleString(language==='id'?'id-ID':'en-US')}</Text>
   {item.requester_is_member&&<InviteButton label={t('joinRequestOpenWallet')} onPress={async()=>{if(await openJoinedWorkspace(item.workspace_id))router.replace('/(tabs)')}}/>}
   {item.status==='pending'&&<InviteButton outline label={t('joinRequestCancel')} disabled={requests.workingIds.includes(item.id)} onPress={()=>requests.cancel(item.id)}/>}
   {!item.requester_is_member&&item.status!=='pending'&&<InviteButton outline label={t('scanInviteManual')} onPress={()=>router.push('/scan-invite')}/>}
  </View>)}
  {requests.hasMore&&<InviteButton outline disabled={requests.loading} label={t('joinRequestsLoadMore')} onPress={requests.loadMore}/>}
  <InviteButton outline label={t('joinRequestRefresh')} onPress={requests.refresh} disabled={requests.loading}/>
 </ScrollView></View>
}
