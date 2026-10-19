import React from 'react'
import { View, Text } from 'react-native'
import { useLanguage } from '../context/LanguageContext'
import { InviteButton, inviteStyles as s } from './InviteControls'
import type { InviteQrScannerProps } from './InviteQrScanner'
export default function InviteQrScanner({onManualEntry}:InviteQrScannerProps) {
 const {t}=useLanguage()
 return <View style={{gap:12}}><Text style={s.body}>{t('scanInviteWeb')}</Text><InviteButton outline label={t('scanInviteManual')} onPress={onManualEntry}/></View>
}
