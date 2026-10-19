import React, { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useLanguage } from '../context/LanguageContext'
import { Colors } from '../constants/theme'
import { InviteButton, inviteStyles as s } from './InviteControls'
import { inviteErrorKey, joinStatusKeys } from '../lib/inviteCopy'
import type { useInviteAdmission } from '../hooks/useInviteAdmission'

type Admission = Pick<ReturnType<typeof useInviteAdmission>, 'preview'|'state'|'loading'|'submitting'|'error'|'retryAt'|'registered'|'submit'|'cancel'|'refresh'|'openWallet'>
export function InviteAdmissionPanel({ admission:a, accountLabel, onLogin, onScan }: { admission:Admission; accountLabel:string; onLogin:()=>void|Promise<void>; onScan:()=>void }) {
  const { t } = useLanguage()
  const request = a.state?.state === 'request' ? a.state.request : null
  const name = a.preview?.wallet_name ?? (a.state?.state === 'already_member' ? a.state.wallet_name : request?.wallet_name)
  const deadline = a.retryAt ?? (request?.can_retry_at ? Date.parse(request.can_retry_at) : 0)
  const [now,setNow] = useState(Date.now())
  useEffect(() => {
    setNow(Date.now())
    if (!deadline || deadline <= Date.now()) return
    const timer=setInterval(()=>{const n=Date.now();setNow(n);if(n>=deadline)clearInterval(timer)},1000)
    return ()=>clearInterval(timer)
  },[deadline])
  const remaining=Math.max(0,Math.ceil((deadline-now)/1000))
  const member=a.state?.state==='already_member'||Boolean(request?.requester_is_member)
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.title}>{name ?? t('inviteTitle')}</Text>
    <Text style={s.body}>{t('joinRequestExplain')}</Text>
    {accountLabel ? <Text style={s.subtitle}>{accountLabel}</Text> : null}
    {a.loading && <ActivityIndicator color={Colors.primary} accessibilityLabel={t('joinLoading')} />}
    {a.error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{t(inviteErrorKey(a.error))}</Text>}
    {request && <Text testID={request.status==='pending'?'join-pending':`join-${request.status}`} accessibilityLiveRegion="polite" style={s.subtitle}>{t(joinStatusKeys[request.status])}</Text>}
    {a.state?.state==='already_member' && <Text style={s.body}>{t('joinRequestAlreadyMember')}</Text>}
    {member && <InviteButton testID="open-wallet" label={t('joinRequestOpenWallet')} disabled={a.submitting} onPress={a.openWallet} />}
    {!a.registered && a.preview && <InviteButton testID="invite-login" label={t('inviteBtnSignInGoogle')} onPress={onLogin} disabled={a.submitting} />}
    {a.registered && a.state?.state==='available' && a.preview && !a.error && <InviteButton testID="request-join" label={t('joinRequestSubmit')} disabled={a.submitting} onPress={()=>a.submit(false)} />}
    {request?.status==='pending' && <InviteButton testID="cancel-join-request" outline label={t('joinRequestCancel')} disabled={a.submitting} onPress={a.cancel} />}
    {request?.status==='approved' && !member && <Text style={s.body}>{t('joinRequestRemoved')}</Text>}
    {remaining>0 && <Text style={s.body}>{t('joinRequestCooldown')} {remaining} {t('joinSeconds')}</Text>}
    {a.registered && request && request.status!=='pending' && !member && a.preview && <InviteButton testID="retry-join-request" label={t('joinRequestRetry')} disabled={a.submitting||remaining>0} onPress={()=>a.submit(true)} />}
    {(a.error || (!a.preview && !member && !a.loading)) && <InviteButton outline label={t('scanInviteManual')} onPress={onScan} />}
    <InviteButton testID="refresh-invite" outline label={t('joinRequestRefresh')} disabled={a.loading||a.submitting} onPress={a.refresh} />
  </View>
}
