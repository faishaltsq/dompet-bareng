'use no memo'
import React from 'react'
import { FlexWidget, ImageWidget, type ImageWidgetSource, OverlapWidget, TextWidget } from 'react-native-android-widget'
import { MASCOT_IMAGES } from '../lib/companion'
import { formatCompactRupiah, type WidgetPayload } from '../lib/widgetPayload'
import { getWidgetLayout, WIDGET_THEMES } from './widgetDesign'

export function getShortWidgetAdvice(payload: WidgetPayload): string {
  const id = payload.language === 'id'
  if (!payload.updatedAt) return id ? 'Buka app' : 'Open app'
  switch (payload.mood) {
    case 'PANIC': return id ? 'Rem dulu!' : 'Slow down!'
    case 'WARNING': return id ? 'Tahan jajan' : 'Hold off'
    case 'NEUTRAL': return id ? 'Pantau terus' : 'Keep track'
    case 'HAPPY': return payload.todayCount === 0
      ? id ? 'Belum keluar' : 'No spending'
      : id ? 'Masih aman' : 'Looking good'
    case 'RICH': return id ? 'Dompet tebal' : 'Wallet loaded'
    case 'REMINDER': return id ? 'Tahan dulu' : 'Ease off'
    case 'WELCOME': return id ? 'Mulai catat' : 'Start logging'
    case 'THINKING': return id ? 'Isi pemasukan' : 'Add income'
  }
}

export function SmallOtterWidget({ payload, layout }: {
  payload: WidgetPayload; layout: ReturnType<typeof getWidgetLayout>
}) {
  const theme = WIDGET_THEMES[payload.mood]
  const id = payload.language === 'id'
  const tiny = layout.height < 125
  const padding = tiny ? 10 : layout.padding
  const amount = formatCompactRupiah(payload.todayExpense, payload.language)
  const label = `${payload.walletName}. ${id ? 'Pengeluaran hari ini' : "Today's spending"}: ${amount}. ${payload.todayCount} ${id ? 'transaksi' : 'transactions'}. ${payload.suggestion}`
  return (
    <OverlapWidget clickAction="OPEN_APP" accessibilityLabel={label}
      style={{ width: 'match_parent', height: 'match_parent', backgroundColor: theme.background,
        borderRadius: 22, borderWidth: 1, borderBottomWidth: 4, borderColor: theme.border, overflow: 'hidden' }}>
      <FlexWidget style={{ width: layout.mascotSize + 22, height: layout.mascotSize + 22,
        borderRadius: layout.mascotSize, backgroundColor: theme.decoration,
        marginLeft: layout.mascotLeft - 12, marginTop: layout.mascotTop - 12 }} />
      <ImageWidget image={MASCOT_IMAGES[payload.mood] as ImageWidgetSource}
        imageWidth={layout.mascotSize} imageHeight={layout.mascotSize} resizeMode="contain"
        style={{ marginLeft: layout.mascotLeft, marginTop: layout.mascotTop }} />
      <FlexWidget style={{ width: 'match_parent', height: 'match_parent', padding,
        flexDirection: 'column', justifyContent: 'space-between' }}>
        <FlexWidget style={{ width: 'match_parent' }}>
          <TextWidget text={payload.walletName} maxLines={1} truncate="END"
            style={{ fontSize: tiny ? 11 : 12, fontWeight: '800', color: theme.ink }} />
          <TextWidget text={id ? 'Keluar hari ini' : 'Spent today'}
            style={{ fontSize: tiny ? 8 : 9, color: theme.muted, marginTop: 2 }} />
          <TextWidget text={amount} maxLines={1}
            style={{ width: Math.max(48, layout.contentWidth), fontSize: tiny ? 24 : 28,
              fontWeight: '900', color: theme.accent, adjustsFontSizeToFit: true }} />
        </FlexWidget>
        <FlexWidget style={{ width: Math.max(42, layout.mascotLeft - padding - 4), height: tiny ? 28 : 38, paddingHorizontal: 5,
          borderRadius: 10, backgroundColor: theme.surface, justifyContent: 'center' }}>
          <TextWidget text={getShortWidgetAdvice(payload)} maxLines={2} truncate="END"
            style={{ fontSize: tiny ? 9 : 10, fontWeight: '700', color: theme.ink }} />
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  )
}
