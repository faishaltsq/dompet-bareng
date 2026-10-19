import React from 'react'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { buildWidgetTree, type WidgetTree } from 'react-native-android-widget/src/api/build-widget-tree'
import { OtterWidget } from '../../widgets/OtterWidget'
import { getWidgetLayout, WIDGET_THEMES } from '../../widgets/widgetDesign'
import { buildEmptyWidgetPayload } from '../widgetPayload'

vi.mock('react-native', () => ({ Image: { resolveAssetSource: (id: number) => ({ uri: `test-asset:${id}` }) } }))
vi.mock('react-native-android-widget', async () => ({
  ...await import('react-native-android-widget/src/widgets/FlexWidget'),
  ...await import('react-native-android-widget/src/widgets/OverlapWidget'),
  ...await import('react-native-android-widget/src/widgets/TextWidget'),
  ...await import('react-native-android-widget/src/widgets/ImageWidget'),
}))

const bounds = [
  { name: 'small', width: 140, height: 140 },
  { name: 'medium', width: 320, height: 160 },
  { name: 'large', width: 320, height: 320 },
  { name: 'small-min', width: 110, height: 110 },
  { name: 'medium-min', width: 250, height: 110 },
  { name: 'large-min', width: 250, height: 250 },
]
const moods = ['HAPPY', 'NEUTRAL', 'WARNING', 'PANIC'] as const
const languages = ['id', 'en'] as const
const suggestions = {
  HAPPY: ['Dompet masih aman. Pertahankan kebiasaan baikmu!', 'Looking good. Keep up your healthy habits!'],
  NEUTRAL: ['Tetap pantau pengeluaran bulan ini, ya.', 'Keep an eye on your monthly spending.'],
  WARNING: ['Bulan ini sudah 90% terpakai. Tahan jajan dulu.', '90% used this month. Hold off extras.'],
  PANIC: ['Pengeluaran lewat pemasukan. Kurangi belanja tambahan.', 'Spending exceeds income. Cut back on extras.'],
}
const cases = bounds.flatMap(size => moods.flatMap(mood => languages.map(language => {
  const payload = Object.assign(buildEmptyWidgetPayload(language, language === 'id' ? 'Dompet Keluarga' : 'Family Wallet'), {
    mood, color: WIDGET_THEMES[mood].accent, todayExpense: 125000, todayCount: 3,
    monthExpense: 1250000, monthIncome: 2000000, monthBalance: 750000,
    topCategory: { name: language === 'id' ? 'Makan & Minum' : 'Food & Drinks', amount: 450000 },
    updatedAt: '2026-10-19T07:00:00.000Z', suggestion: suggestions[mood][language === 'id' ? 0 : 1],
  })
  return { ...size, mood, language, payload,
    layout: getWidgetLayout(size.width, size.height), theme: WIDGET_THEMES[mood],
    mascotFile: `mascot/otter-${mood === 'NEUTRAL' ? 'idle' : mood.toLowerCase()}.png`,
  }
})))

function flatten(tree: WidgetTree): WidgetTree[] {
  return [tree, ...(tree.children ?? []).flatMap(flatten)]
}

describe('all widget sizes, palettes and languages', () => {
  it.each(cases)('$name / $mood / $language serializes a readable native tree', ({ width, height, mood, language, payload }) => {
    const tree = buildWidgetTree(React.createElement(OtterWidget, { widthDp: width, heightDp: height, payload }))
    const nodes = flatten(tree)
    expect(tree.props).toMatchObject({ backgroundColor: WIDGET_THEMES[mood].background, clickAction: 'OPEN_APP' })
    expect((tree.props as { accessibilityLabel: string }).accessibilityLabel).toContain(payload.suggestion)
    const images = nodes.filter(node => node.type === 'ImageWidget')
    expect(images).toHaveLength(1)
    expect(images[0].props).not.toHaveProperty('backgroundColor')
    expect(images[0].props).toHaveProperty('image.uri')
    const text = nodes.filter(node => node.type === 'TextWidget').map(node => (node.props as { text: string }).text)
    expect(text).toContain(language === 'id' ? 'Rp 125rb' : 'Rp 125K')
    expect(text).toContain(payload.walletName)
  })

  it('exports the production widget trees for optional visual rendering', () => {
    const output = process.env.WIDGET_PREVIEW_OUTPUT
    if (!output) return
    const data = cases.map(item => ({ ...item,
      tree: buildWidgetTree(React.createElement(OtterWidget, {
        payload: item.payload, widthDp: item.width, heightDp: item.height,
      })),
    }))
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, JSON.stringify(data, null, 2))
    expect(data).toHaveLength(bounds.length * moods.length * languages.length)
  })
})
