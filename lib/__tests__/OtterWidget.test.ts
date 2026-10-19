import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { buildWidgetTree, type WidgetTree } from 'react-native-android-widget/src/api/build-widget-tree'
import { OtterWidget } from '../../widgets/OtterWidget'
import { buildEmptyWidgetPayload, type WidgetPayload } from '../widgetPayload'
import { getWidgetLayout, WIDGET_THEMES } from '../../widgets/widgetDesign'

vi.mock('react-native', () => ({
  Image: { resolveAssetSource: (id: number) => ({ uri: `test-asset:${id}` }) },
}))

// Use the actual widget primitives/serialization, mocking only their native image boundary.
vi.mock('react-native-android-widget', async () => ({
  ...await import('react-native-android-widget/src/widgets/FlexWidget'),
  ...await import('react-native-android-widget/src/widgets/OverlapWidget'),
  ...await import('react-native-android-widget/src/widgets/TextWidget'),
  ...await import('react-native-android-widget/src/widgets/ImageWidget'),
}))

function flatten(tree: WidgetTree): WidgetTree[] {
  return [tree, ...(tree.children ?? []).flatMap(flatten)]
}

function render(payload = buildEmptyWidgetPayload(), heightDp = 160, widthDp = 320) {
  return buildWidgetTree(React.createElement(OtterWidget, { payload, widthDp, heightDp }))
}

describe('OtterWidget serialization', () => {
  it.each(['id', 'en'] as const)('keeps the transaction count visible on a compact daily card in %s', language => {
    const payload = { ...buildEmptyWidgetPayload(language), todayCount: 2, updatedAt: '2026-10-19T06:00:00.000Z' }
    const text = flatten(render(payload, 110, 250)).filter(node => node.type === 'TextWidget')
      .map(node => (node.props as { text: string }).text)
    expect(text.some(value => value.includes(language === 'id' ? '2 transaksi' : '2 transactions'))).toBe(true)
  })

  it('leaves native font padding for two advice lines at minimum daily-card height', () => {
    const payload = buildEmptyWidgetPayload()
    const advice = flatten(render(payload, 110, 250)).find(node =>
      node.type === 'TextWidget' && (node.props as { text?: string }).text === payload.suggestion)
    expect(advice?.props).toMatchObject({ fontSize: 9, maxLines: 2 })
  })

  it('shows known legacy monthly spending without inventing income or monthly net', () => {
    const payload = { ...buildEmptyWidgetPayload(), monthExpense: 125000,
      updatedAt: '2026-10-19T06:00:00.000Z' }
    const text = flatten(render(payload, 320)).filter(node => node.type === 'TextWidget')
      .map(node => (node.props as { text: string }).text)
    expect(text).toContain('Rp 125rb')
    expect(text.filter(value => value === '—')).toHaveLength(3)
  })

  it('gives the daily card a larger mascot, dominant amount and a solid mood palette', () => {
    const tree = render({ ...buildEmptyWidgetPayload(), mood: 'HAPPY', todayExpense: 25000 }, 160)
    const nodes = flatten(tree)
    expect(tree.props).toMatchObject({ backgroundColor: WIDGET_THEMES.HAPPY.background })
    const amount = nodes.find(node => (node.props as { text?: string }).text === 'Rp 25rb')
    expect((amount?.props as { fontSize: number }).fontSize).toBeGreaterThanOrEqual(30)
    expect((nodes.find(node => node.type === 'ImageWidget')?.props as { imageWidth: number }).imageWidth)
      .toBeGreaterThanOrEqual(130)
  })

  it('keeps a small square focused on a prominent amount and short advice', () => {
    const payload = {
      ...buildEmptyWidgetPayload('id', 'Keluarga'), mood: 'PANIC' as const,
      todayExpense: 25000, todayCount: 1,
      updatedAt: '2026-10-19T06:00:00.000Z',
      suggestion: 'Pengeluaran bulan ini melampaui pemasukan. Kurangi belanja tambahan.',
    }
    const nodes = flatten(render(payload, 140, 140))
    const amount = nodes.find(node => (node.props as { text?: string }).text === 'Rp 25rb')
    expect((amount?.props as { fontSize: number }).fontSize).toBeGreaterThanOrEqual(26)
    expect(JSON.stringify(nodes)).toContain('Rem dulu!')
    expect(JSON.stringify(nodes)).not.toContain('DOMPET BARENG')
    expect(JSON.stringify(nodes)).not.toContain('Pemasukan')
    expect(nodes.find(node => node.type === 'ImageWidget')?.props).not.toHaveProperty('backgroundColor')
  })

  it('uses extra space for a readable monthly summary rather than scaling up the daily card', () => {
    const payload = Object.assign(buildEmptyWidgetPayload('id', 'Keluarga'), {
      todayExpense: 125000, todayCount: 2, monthExpense: 125000,
      monthIncome: 1000000, monthBalance: 875000,
      topCategory: { name: 'Makan & Minum', amount: 75000 },
      suggestion: 'Tetap pantau pengeluaran bulan ini.',
    })
    const nodes = flatten(render(payload, 320)).filter(node => node.type === 'TextWidget')
    const text = JSON.stringify(nodes)
    for (const detail of ['Pemasukan', 'Pengeluaran', 'Selisih bulan ini', 'Kategori terbesar', 'Rp 1jt', 'Rp 875rb', 'Makan & Minum']) {
      expect(text).toContain(detail)
    }
    expect(nodes.find(node => (node.props as { text: string }).text === payload.suggestion)?.props)
      .toMatchObject({ maxLines: 3 })
  })

  it('prioritizes the amount and advice in the minimum-height compact layout', () => {
    const nodes = flatten(render(buildEmptyWidgetPayload('id', 'Keluarga'), 110))
      .filter((node) => node.type === 'TextWidget')
    const text = JSON.stringify(nodes)
    expect(text).toContain('Keluarga')
    expect(text).toContain('Pengeluaran Hari Ini')
    expect(text).toContain('Rp 0')
    expect(text).toContain('Buka app untuk memperbarui data.')
    expect(text).not.toContain('DOMPET BARENG')
    expect(text).not.toContain('Belum ada transaksi')
  })

  it('produces a rounded, clickable widget using the real library converter', () => {
    const tree = render()
    expect(tree.type).toBe('FrameLayoutWidget')
    expect(tree.props).toMatchObject({ clickAction: 'OPEN_APP', width: 'match_parent', height: 'match_parent' })
    expect(tree.props).toMatchObject({ backgroundColor: WIDGET_THEMES.NEUTRAL.background })
    expect(tree.props).toHaveProperty('accessibilityLabel')
    expect(JSON.stringify(tree)).toContain('Pengeluaran Hari Ini')
  })

  it.each([
    [50, 86], [110, 119], [200, 147],
  ])('clamps mascot size at widget height %i to %i dp', (height, expected) => {
    const image = flatten(render(buildEmptyWidgetPayload(), height)).find((node) => node.type === 'ImageWidget')
    expect(image?.props).toMatchObject({ imageWidth: expected, imageHeight: expected, resizeMode: 'contain' })
  })

  it.each(['HAPPY', 'NEUTRAL', 'WARNING', 'PANIC'] as const)('resolves a static mascot for mood %s', (mood) => {
    const image = flatten(render({ ...buildEmptyWidgetPayload(), mood })).find((node) => node.type === 'ImageWidget')
    expect(image?.props).toHaveProperty('image.uri')
    expect(JSON.stringify(image?.props)).not.toContain('test-asset:0')
  })

  it.each(['id', 'en'] as const)('renders localized spending, expense count and advice in %s', (language) => {
    const payload: WidgetPayload = {
      ...buildEmptyWidgetPayload(language, 'Keluarga'),
      todayExpense: 125000, todayCount: 2, suggestion: 'Otter advice',
    }
    const nodes = flatten(render(payload)).filter((node) => node.type === 'TextWidget')
    const text = JSON.stringify(nodes)
    expect(text).toContain('Keluarga')
    expect(text).toContain(language === 'id' ? 'Pengeluaran Hari Ini' : "Today's Spending")
    expect(text).toContain(language === 'id' ? 'Rp 125rb' : 'Rp 125K')
    expect(text).toContain(language === 'id' ? '2 transaksi' : '2 transactions')
    expect(text).toContain('Otter advice')
    expect(nodes.find((node) => (node.props as { text: string }).text === 'Otter advice')?.props)
      .toMatchObject({ maxLines: 2, truncate: 'END' })
  })
})
