import type { TranslationKey } from '@/context/LanguageContext'

// Provider names are persisted by Android. Keep OtterWidget for existing medium widgets.
export const WIDGET_VARIANTS = [
  { name: 'OtterWidgetSmall', kind: 'small', columns: 2, rows: 2, labelKey: 'widgetSizeSmall', descriptionKey: 'widgetSizeSmallDesc' },
  { name: 'OtterWidget', kind: 'medium', columns: 4, rows: 2, labelKey: 'widgetSizeMedium', descriptionKey: 'widgetSizeMediumDesc' },
  { name: 'OtterWidgetLarge', kind: 'large', columns: 4, rows: 4, labelKey: 'widgetSizeLarge', descriptionKey: 'widgetSizeLargeDesc' },
] as const satisfies ReadonlyArray<{
  name: string
  kind: 'small' | 'medium' | 'large'
  columns: number
  rows: number
  labelKey: TranslationKey
  descriptionKey: TranslationKey
}>

export type WidgetName = (typeof WIDGET_VARIANTS)[number]['name']
export const WIDGET_NAMES: readonly WidgetName[] = WIDGET_VARIANTS.map((variant) => variant.name)
