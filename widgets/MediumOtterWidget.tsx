'use no memo'
import React from 'react'
import { FlexWidget, ImageWidget, type ImageWidgetSource, OverlapWidget, TextWidget } from 'react-native-android-widget'
import { MASCOT_IMAGES } from '../lib/companion'
import { formatCompactRupiah, type WidgetPayload } from '../lib/widgetPayload'
import { getWidgetLayout, WIDGET_THEMES } from './widgetDesign'

export function MediumOtterWidget({ payload, layout }: {
  payload: WidgetPayload; layout: ReturnType<typeof getWidgetLayout>
}) {
  const theme = WIDGET_THEMES[payload.mood]
  const id = payload.language === 'id'
  const compact = layout.height < 160
  const tiny = layout.height < 120
  const padding = tiny ? 8 : layout.height < 135 ? 10 : 14
  const amount = formatCompactRupiah(payload.todayExpense, payload.language)
  const count = payload.todayCount === 0
    ? id ? 'Belum ada transaksi' : 'No transactions yet'
    : `${payload.todayCount} ${id ? 'transaksi' : 'transactions'}`
  return (
    <OverlapWidget clickAction="OPEN_APP"
      accessibilityLabel={`${payload.walletName}. ${id ? 'Pengeluaran hari ini' : "Today's spending"}: ${amount}. ${count}. ${payload.suggestion}`}
      style={{ width: 'match_parent', height: 'match_parent', backgroundColor: theme.background,
        borderRadius: 24, borderWidth: 1, borderBottomWidth: 5, borderColor: theme.border, overflow: 'hidden' }}>
      <FlexWidget style={{ width: layout.mascotSize + 44, height: layout.mascotSize + 44,
        borderRadius: layout.mascotSize, backgroundColor: theme.decoration,
        marginLeft: layout.width - layout.mascotSize - 22,
        marginTop: Math.round((layout.height - layout.mascotSize - 44) / 2) }} />
      <ImageWidget image={MASCOT_IMAGES[payload.mood] as ImageWidgetSource}
        imageWidth={layout.mascotSize} imageHeight={layout.mascotSize} resizeMode="contain"
        style={{ marginLeft: layout.mascotLeft, marginTop: layout.mascotTop }} />
      <FlexWidget style={{ width: layout.contentWidth + padding * 2, height: 'match_parent',
        paddingHorizontal: padding, paddingVertical: padding, justifyContent: 'space-between' }}>
        <FlexWidget style={{ width: 'match_parent' }}>
          {layout.height >= 180 && <TextWidget text="DOMPET BARENG"
            style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1, color: theme.muted }} />}
          <TextWidget text={payload.walletName} maxLines={1} truncate="END"
            style={{ fontSize: tiny ? 10 : compact ? 11 : 13, fontWeight: '800', color: theme.ink }} />
          <TextWidget text={compact && payload.updatedAt
            ? `${id ? 'Hari ini' : 'Today'} · ${payload.todayCount} ${id ? 'transaksi' : 'transactions'}`
            : id ? 'Pengeluaran Hari Ini' : "Today's Spending"} maxLines={1} truncate="END"
            style={{ fontSize: tiny ? 8 : compact ? 9 : 10, color: theme.muted }} />
          <TextWidget text={amount} maxLines={1}
            style={{ fontSize: layout.amountSize, fontWeight: '900', color: theme.accent,
              adjustsFontSizeToFit: true }} />
          {!compact && <TextWidget text={count} style={{ fontSize: 10, color: theme.muted }} />}
        </FlexWidget>
        <FlexWidget style={{ width: 'match_parent', height: tiny ? 30 : compact ? 32 : 36, paddingHorizontal: 8,
          borderRadius: 10, backgroundColor: theme.surface, justifyContent: 'center' }}>
          <TextWidget text={payload.suggestion} maxLines={2} truncate="END"
            style={{ fontSize: tiny ? 9 : compact ? 10 : 11, fontWeight: '600', color: theme.ink }} />
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  )
}
