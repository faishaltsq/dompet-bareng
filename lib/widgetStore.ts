import AsyncStorage from '@react-native-async-storage/async-storage'
import { WIDGET_STORAGE_KEY, type WidgetPayload } from './widgetPayload'

export async function writeWidgetPayload(payload: WidgetPayload): Promise<void> {
  try {
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // best effort
  }
}

function isTopCategory(value: unknown): value is NonNullable<WidgetPayload['topCategory']> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const category = value as Record<string, unknown>
  return typeof category.name === 'string' && category.name.trim().length > 0
    && typeof category.amount === 'number' && Number.isFinite(category.amount) && category.amount >= 0
}

function isWidgetPayload(value: unknown): value is WidgetPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const payload = value as Record<string, unknown>
  return typeof payload.walletName === 'string'
    && typeof payload.suggestion === 'string'
    && typeof payload.updatedAt === 'string'
    && (payload.updatedAt === '' || Number.isFinite(Date.parse(payload.updatedAt)))
    && (payload.mood === 'HAPPY' || payload.mood === 'NEUTRAL'
      || payload.mood === 'WARNING' || payload.mood === 'PANIC')
    && (payload.language === 'id' || payload.language === 'en')
    && typeof payload.color === 'string' && /^#[0-9a-f]{6}$/i.test(payload.color)
    && typeof payload.todayExpense === 'number'
    && Number.isFinite(payload.todayExpense) && payload.todayExpense >= 0
    && typeof payload.monthExpense === 'number'
    && Number.isFinite(payload.monthExpense) && payload.monthExpense >= 0
    && typeof payload.todayCount === 'number'
    && Number.isSafeInteger(payload.todayCount) && payload.todayCount >= 0
    && (!('monthIncome' in payload)
      || (typeof payload.monthIncome === 'number'
        && Number.isFinite(payload.monthIncome) && payload.monthIncome >= 0))
    && (!('monthBalance' in payload)
      || (typeof payload.monthBalance === 'number' && Number.isFinite(payload.monthBalance)))
    && (!('topCategory' in payload) || payload.topCategory === null || isTopCategory(payload.topCategory))
}

export async function readWidgetPayload(): Promise<WidgetPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY)
    if (!raw) return null
    const payload: unknown = JSON.parse(raw)
    return isWidgetPayload(payload) ? payload : null
  } catch {
    return null
  }
}
