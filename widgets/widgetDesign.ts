import type { MascotMood } from '../lib/companion'

export type WidgetLayoutKind = 'small' | 'medium' | 'large'
type Color = `#${string}`

export interface WidgetTheme {
  background: Color
  surface: Color
  decoration: Color
  border: Color
  ink: Color
  muted: Color
  accent: Color
}

export const WIDGET_THEMES: Record<MascotMood, WidgetTheme> = {
  WELCOME: {
    background: '#FFE3CC', surface: '#FFF1E6', decoration: '#F7CC9E', border: '#E9B48A',
    ink: '#5A3410', muted: '#80592E', accent: '#8F4407',
  },
  THINKING: {
    background: '#E4E4FB', surface: '#EEEEFC', decoration: '#C4C4EF', border: '#ADADF0',
    ink: '#26265A', muted: '#4C4C7E', accent: '#4337A0',
  },
  RICH: {
    background: '#FFE9A8', surface: '#FFF6DC', decoration: '#F6D570', border: '#E8C256',
    ink: '#5A4206', muted: '#7F6420', accent: '#7D5500',
  },
  REMINDER: {
    background: '#CFEFEA', surface: '#E2F7F6', decoration: '#A7DED8', border: '#86CFC8',
    ink: '#0B3F3C', muted: '#2F6763', accent: '#0C6E68',
  },
  HAPPY: {
    background: '#DDF3C4', surface: '#EDF9E0', decoration: '#C8E8A7', border: '#B3D48F',
    ink: '#203B1C', muted: '#47613B', accent: '#28611C',
  },
  NEUTRAL: {
    background: '#DBECFA', surface: '#EFF7FE', decoration: '#C0DDF2', border: '#ACCDE6',
    ink: '#203C56', muted: '#47617A', accent: '#205D92',
  },
  WARNING: {
    background: '#FFE5B3', surface: '#FFF2DA', decoration: '#F7D38D', border: '#E7C077',
    ink: '#553513', muted: '#77562D', accent: '#8A470B',
  },
  PANIC: {
    background: '#FFDCD5', surface: '#FFF0EB', decoration: '#F8C1B7', border: '#E6A69A',
    ink: '#592622', muted: '#80514A', accent: '#A0252D',
  },
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function getWidgetLayout(widthDp: number, heightDp: number) {
  const width = Math.round(Math.max(96, Number.isFinite(widthDp) && widthDp > 0 ? widthDp : 320))
  const height = Math.round(Math.max(80, Number.isFinite(heightDp) && heightDp > 0 ? heightDp : 160))
  const kind: WidgetLayoutKind = width < 220 ? 'small' : height >= 250 ? 'large' : 'medium'
  const shortSide = Math.min(width, height)
  const padding = kind === 'small' ? 12 : kind === 'large' ? height < 280 ? 12 : clamp(Math.round(shortSide * 0.05), 14, 20) : 16
  const gap = kind === 'large' ? height < 280 ? 4 : clamp(Math.round(shortSide * 0.025), 6, 10) : 6
  const mascotSize = kind === 'small'
    ? clamp(Math.round(Math.min(width * 0.62, height - (height < 125 ? 72 : 82))), 32, 108)
    : kind === 'large'
      ? Math.round(Math.min(width * 0.48, height * 0.46))
      : Math.round(Math.min(width * 0.46, height * 1.08))
  const heroHeight = Math.round(clamp(height * 0.36, 90, 160))
  const adviceHeight = kind === 'large' ? Math.round(clamp(height * 0.14, 34, 64)) : 32
  return {
    kind, width, height, padding, gap, mascotSize, heroHeight,
    mascotLeft: Math.round(width - mascotSize + (kind === 'small' ? -6 : 2)),
    mascotTop: kind === 'large' ? Math.max(0, padding + heroHeight - mascotSize + 8)
      : kind === 'small' ? height - mascotSize - 6
        : Math.max(-6, Math.round((height - mascotSize) / 2)),
    amountSize: kind === 'small' ? 28 : kind === 'large' ? clamp(Math.round(shortSide * 0.12), 32, 46)
      : height < 120 ? 22 : height < 135 ? 28 : 32,
    contentWidth: kind === 'small' ? width - padding * 2
      : Math.max(100, Math.round(width - mascotSize * 0.82 - padding * 2)),
    tileWidth: Math.floor((width - padding * 2 - gap) / 2),
    tileHeight: kind === 'large' ? Math.max(32, Math.min(80, Math.floor((height - padding * 2 - heroHeight - adviceHeight - 12 - gap * 4) / 2))) : 0,
    adviceHeight,
  }
}
