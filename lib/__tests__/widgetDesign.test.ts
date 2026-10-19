import { describe, expect, it } from 'vitest'
import { getWidgetLayout, WIDGET_THEMES } from '../../widgets/widgetDesign'

function luminance(color: string) {
  const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

describe('adaptive widget design', () => {
  it.each([[140, 140, 74], [110, 110, 64]])('reserves the amount header above small mascot bounds %s x %s', (width, height, headerBottom) => {
    const layout = getWidgetLayout(width, height)
    expect(layout.mascotTop).toBeGreaterThanOrEqual(headerBottom)
    expect(layout.mascotTop + layout.mascotSize).toBeLessThanOrEqual(height - 6)
  })

  it('reserves native font-padding space for the large transaction count', () => {
    expect(getWidgetLayout(320, 320).heroHeight).toBeGreaterThanOrEqual(115)
  })

  it('leaves room for two complete advice lines on the daily card', () => {
    expect(getWidgetLayout(320, 160).amountSize).toBeLessThanOrEqual(32)
  })

  it.each([
    [110, 110, 'small'], [140, 140, 'small'], [219, 400, 'small'],
    [220, 110, 'medium'], [320, 160, 'medium'], [320, 249, 'medium'],
    [250, 250, 'large'], [320, 320, 'large'], [400, 420, 'large'],
  ] as const)('selects layout from actual bounds %s x %s rather than provider name', (width, height, kind) => {
    expect(getWidgetLayout(width, height).kind).toBe(kind)
  })

  it.each([[Number.NaN, Infinity], [0, 0], [-1, -10]])('sanitizes unavailable launcher bounds %s x %s', (width, height) => {
    const layout = getWidgetLayout(width, height)
    for (const value of Object.values(layout).filter(value => typeof value === 'number')) {
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  it.each([[220, 250], [250, 250], [320, 250], [320, 320], [400, 420], [500, 500]])(
    'fits the summary and advice inside large bounds %s x %s', (width, height) => {
      const layout = getWidgetLayout(width, height)
      const occupiedHeight = layout.padding * 2 + layout.heroHeight + 12 + layout.gap * 4
        + layout.tileHeight * 2 + layout.adviceHeight
      expect(occupiedHeight).toBeLessThanOrEqual(layout.height)
      expect(layout.tileWidth * 2 + layout.gap + layout.padding * 2).toBeLessThanOrEqual(layout.width)
      expect(layout.tileHeight).toBeGreaterThanOrEqual(32)
    },
  )

  it.each(Object.entries(WIDGET_THEMES))('keeps readable foregrounds on the opaque %s palette', (_, theme) => {
    for (const background of [theme.background, theme.surface]) {
      expect(background).toMatch(/^#[0-9A-F]{6}$/)
      for (const foreground of [theme.ink, theme.muted, theme.accent]) {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
