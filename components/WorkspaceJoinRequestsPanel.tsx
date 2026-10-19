import React from 'react'
import { View, Text, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native'
import { useIsFocused } from 'expo-router'
import SwipeableModal from './SwipeableModal'
import { InviteButton, inviteStyles as s } from './InviteControls'
import { useLanguage } from '../context/LanguageContext'
import { useJoinRequests } from '../hooks/useJoinRequests'
import { inviteErrorKey, joinStatusKeys } from '../lib/inviteCopy'

type Props={visible:boolean;workspaceId:string;onClose:()=>void}
export function WorkspaceJoinRequestsPanel({visible,workspaceId,onClose}:Props) {
 const {t,language}=useLanguage()
 const focused=useIsFocused()
 const queue=useJoinRequests({type:'admin',workspaceId},visible&&focused)
 return <SwipeableModal visible={visible} onClose={onClose} contentStyle={{paddingHorizontal:0,flexShrink:1}}>
  <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={queue.loading} onRefresh={()=>{void queue.refresh()}}/>}>
   <Text accessibilityRole="header" style={s.title}>{t('joinRequestsTitle')} ({queue.pendingCount})</Text>
   {queue.loading&&<ActivityIndicator accessibilityLabel={t('joinLoading')}/>}
   {queue.error&&<Text accessibilityRole="alert" style={s.error}>{t(inviteErrorKey(queue.error))}</Text>}
   {queue.lastDecision&&<Text accessibilityLiveRegion="polite" style={s.body}>{t(joinStatusKeys[queue.lastDecision.status])}</Text>}
   {!queue.loading&&!queue.items.length&&<Text style={s.empty}>{t('joinRequestsEmpty')}</Text>}
   {queue.items.map(item=><View key={item.id} style={s.card}>
    <View style={s.row}>
     {item.requester_avatar_url?.startsWith('https://')&&<Image accessibilityLabel={item.requester_display_name??t('userFallback')} source={{uri:item.requester_avatar_url}} style={{width:44,height:44,borderRadius:22}}/>}
     <Text style={[s.subtitle,{flex:1}]}>{item.requester_display_name??t('userFallback')}</Text>
    </View>
    <Text style={s.body}>{new Date(item.created_at).toLocaleString(language==='id'?'id-ID':'en-US')}</Text>
    <InviteButton testID={`approve-${item.id}`} label={t('joinRequestsApprove')} disabled={queue.workingIds.includes(item.id)} onPress={()=>queue.decide(item.id,'approved')}/>
    <InviteButton testID={`reject-${item.id}`} outline label={t('joinRequestsReject')} disabled={queue.workingIds.includes(item.id)} onPress={()=>queue.decide(item.id,'rejected')}/>
   </View>)}
   {queue.hasMore&&<InviteButton outline label={t('joinRequestsLoadMore')} onPress={queue.loadMore} disabled={queue.loading}/>}
   <InviteButton outline label={t('joinRequestRefresh')} onPress={queue.refresh} disabled={queue.loading}/>
   <InviteButton outline label={t('close')} onPress={onClose}/>
  </ScrollView>
 </SwipeableModal>
}
