'use no memo'
import React from 'react'
import { FlexWidget, ImageWidget, type ImageWidgetSource, OverlapWidget, TextWidget } from 'react-native-android-widget'
import { MASCOT_IMAGES } from '../lib/companion'
import { formatCompactRupiah, type WidgetPayload } from '../lib/widgetPayload'
import { getWidgetLayout, WIDGET_THEMES, type WidgetTheme } from './widgetDesign'

type Layout = ReturnType<typeof getWidgetLayout>

function SummaryTile({ title, value, theme, layout, category = false }: {
  title: string; value: string; theme: WidgetTheme; layout: Layout; category?: boolean
}) {
  return (
    <FlexWidget style={{ width: layout.tileWidth, height: layout.tileHeight, backgroundColor: theme.surface,
      borderRadius: 12, paddingHorizontal: 8, paddingVertical: layout.tileHeight < 44 ? 2 : 5,
      justifyContent: 'center' }}>
      <TextWidget text={title} maxLines={1} truncate="END" style={{ fontSize: layout.tileHeight < 40 ? 9 : 10, color: theme.muted }} />
      <TextWidget text={value} maxLines={1} truncate="END"
        style={{ fontSize: category ? 12 : layout.tileHeight < 44 ? 15 : 17, fontWeight: '800', color: theme.ink, adjustsFontSizeToFit: !category }} />
    </FlexWidget>
  )
}

export function LargeOtterWidget({ payload, layout }: { payload: WidgetPayload; layout: Layout }) {
  const theme = WIDGET_THEMES[payload.mood]
  const id = payload.language === 'id'
  const count = `${payload.todayCount} ${id ? 'transaksi' : 'transactions'}`
  const money = (value: number | undefined) => value === undefined ? '—' : formatCompactRupiah(value, payload.language)
  const summary = [
    { title: id ? 'Pemasukan' : 'Income', value: money(payload.monthIncome) },
    { title: id ? 'Pengeluaran' : 'Spending', value: payload.updatedAt ? money(payload.monthExpense) : '—' },
    { title: id ? 'Selisih bulan ini' : 'Monthly net', value: money(payload.monthBalance) },
    { title: id ? 'Kategori terbesar' : 'Top category', value: payload.topCategory?.name ?? '—', category: true },
  ]
  const label = `${payload.walletName}. ${id ? 'Pengeluaran hari ini' : "Today's spending"}: ${money(payload.todayExpense)}. ${count}. ${summary.map(item => `${item.title}: ${item.value}`).join('. ')}. ${payload.suggestion}`
  return (
    <OverlapWidget clickAction="OPEN_APP" accessibilityLabel={label}
      style={{ width: 'match_parent', height: 'match_parent', backgroundColor: theme.background,
        borderRadius: 24, borderWidth: 1, borderBottomWidth: 5, borderColor: theme.border, overflow: 'hidden' }}>
      <FlexWidget style={{ width: layout.mascotSize + 40, height: layout.mascotSize + 40,
        borderRadius: layout.mascotSize, backgroundColor: theme.decoration,
        marginLeft: layout.width - layout.mascotSize - 16, marginTop: -18 }} />
      <ImageWidget image={MASCOT_IMAGES[payload.mood] as ImageWidgetSource}
        imageWidth={layout.mascotSize} imageHeight={layout.mascotSize} resizeMode="contain"
        style={{ marginLeft: layout.mascotLeft, marginTop: layout.mascotTop }} />
      <FlexWidget style={{ width: 'match_parent', height: 'match_parent', padding: layout.padding,
        flexDirection: 'column', justifyContent: 'space-between' }}>
        <FlexWidget style={{ height: layout.heroHeight, width: layout.contentWidth, justifyContent: 'center' }}>
          {layout.heroHeight >= 110 && <TextWidget text="DOMPET BARENG"
            style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1, color: theme.muted }} />}
          <TextWidget text={payload.walletName} maxLines={1} truncate="END"
            style={{ fontSize: 13, fontWeight: '700', color: theme.ink }} />
          <TextWidget text={id ? 'Pengeluaran Hari Ini' : "Today's Spending"}
            style={{ fontSize: 10, color: theme.muted }} />
          <TextWidget text={money(payload.todayExpense)} maxLines={1}
            style={{ fontSize: layout.amountSize, fontWeight: '900', color: theme.accent, adjustsFontSizeToFit: true }} />
          <TextWidget text={count} style={{ fontSize: 10, color: theme.muted }} />
        </FlexWidget>
        <FlexWidget style={{ width: 'match_parent' }}>
          <TextWidget text={id ? 'BULAN INI' : 'THIS MONTH'}
            style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1, color: theme.muted, marginBottom: layout.gap }} />
          <FlexWidget style={{ flexDirection: 'row', flexGap: layout.gap }}>
            {summary.slice(0, 2).map(item => <SummaryTile key={item.title} {...item} theme={theme} layout={layout} />)}
          </FlexWidget>
          <FlexWidget style={{ flexDirection: 'row', flexGap: layout.gap, marginTop: layout.gap }}>
            {summary.slice(2).map(item => <SummaryTile key={item.title} {...item} theme={theme} layout={layout} />)}
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ height: layout.adviceHeight, width: 'match_parent', backgroundColor: theme.surface,
          borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, justifyContent: 'center' }}>
          <TextWidget text={payload.suggestion} maxLines={layout.height >= 280 ? 3 : 2} truncate="END"
            style={{ fontSize: 11, fontWeight: '600', color: theme.ink }} />
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  )
}
