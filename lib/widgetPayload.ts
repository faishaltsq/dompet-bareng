import { evaluateCompanion, calcBudgetUtilisation, FinancialSnapshot, MascotMood } from './companion'

export type WidgetLanguage = 'id' | 'en'

export interface WidgetPayload {
  walletName: string
  todayExpense: number
  todayCount: number
  monthExpense: number
  monthIncome?: number
  monthBalance?: number
  topCategory?: { name: string; amount: number } | null
  mood: MascotMood
  color: string
  suggestion: string
  language: WidgetLanguage
  updatedAt: string
}

export const WIDGET_STORAGE_KEY = '@dompetbareng_widget_payload'

function parseTransactionDate(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  // Date accepts impossible dates by rolling them into the following month.
  const [year, month, day] = dateStr.split('-').map(Number)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null
}

export function isToday(dateStr: string, now: Date = new Date()): boolean {
  const date = parseTransactionDate(dateStr)
  return date !== null && date.toDateString() === now.toDateString()
}

export function sumTodayExpense(
  transactions: Array<{ type: string; amount: number; transaction_date: string }>,
  now: Date = new Date(),
): { total: number; count: number } {
  let total = 0
  let count = 0
  for (const t of transactions) {
    if (t.type === 'expense' && isToday(t.transaction_date, now)) {
      total += t.amount
      count += 1
    }
  }
  return { total, count }
}

export function formatCompactRupiah(amount: number, language: WidgetLanguage): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  const thousandSuffix = language === 'en' ? 'K' : 'rb'
  const millionSuffix = language === 'en' ? 'M' : 'jt'
  const billionSuffix = language === 'en' ? 'B' : 'M'
  if (abs < 1000) return `${sign}Rp ${abs}`
  if (abs < 1_000_000) {
    const v = abs / 1000
    const s = v % 1 === 0 ? `${v}` : v.toFixed(1).replace('.', ',')
    return `${sign}Rp ${s}${thousandSuffix}`
  }
  if (abs < 1_000_000_000) {
    const v = abs / 1_000_000
    const s = v % 1 === 0 ? `${v}` : v.toFixed(1).replace('.', ',')
    return `${sign}Rp ${s}${millionSuffix}`
  }
  const v = abs / 1_000_000_000
  const s = v % 1 === 0 ? `${v}` : v.toFixed(1).replace('.', ',')
  return `${sign}Rp ${s}${billionSuffix}`
}

export interface WidgetSuggestionInput {
  mood: MascotMood
  language: WidgetLanguage
  todayExpense: number
  monthExpense: number
  monthIncome: number
  todayCount: number
  now?: Date
}

export function getWidgetSuggestion(input: WidgetSuggestionInput): string {
  const { mood, language, todayExpense, monthExpense, monthIncome, todayCount } = input
  const now = input.now ?? new Date()
  const id = language === 'id'
  const ratio = monthIncome > 0 ? monthExpense / monthIncome : monthExpense > 0 ? 2 : 0
  const daysLeft = Math.max(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate(),
    1,
  )
  const daily = monthIncome > 0 ? Math.floor((monthIncome - monthExpense) / daysLeft) : 0
  // Dompet kosong (WELCOME) dan dompet sehat (HAPPY) sama-sama tidak punya
  // pengeluaran hari ini — keduanya layak dirayakan, bukan dipanikkan.
  if (todayCount === 0 && (mood === 'HAPPY' || mood === 'WELCOME')) {
    return id ? 'Belum ada pengeluaran hari ini. Mantap! 🎉' : 'No spending recorded today. Great! 🎉'
  }
  switch (mood) {
    case 'WELCOME':
      return id
        ? 'Belum ada transaksi. Buka app buat mulai catat 🐾'
        : 'No transactions yet. Open the app to get started 🐾'
    case 'THINKING':
      return id
        ? 'Pemasukan belum dicatat. Tambah dulu ya 🤔'
        : 'No income recorded yet. Add it first 🤔'
    case 'PANIC':
      return id ? '🚨 Pengeluaran lewat pemasukan! Rem sekarang.' : '🚨 Spending exceeds income! Stop now.'
    case 'REMINDER': {
      // Sama persis dengan calcSafeDays() di companion.ts — runway widget harus
      // identik dengan yang ditampilkan di aplikasi.
      const daysGone = Math.max(now.getDate(), 3)
      const dailyAvg = monthExpense / daysGone
      const runway = dailyAvg > 0 ? Math.max(Math.floor((monthIncome - monthExpense) / dailyAvg), 0) : 999
      return id
        ? `Sisa aman ${runway} hari. Tahan pengeluaran dulu 📣`
        : `${runway} safe days left. Ease off spending 📣`
    }
    case 'WARNING':
      return id
        ? `Udah ${Math.round(ratio * 100)}% pemasukan kepakai. Tahan jajan dulu 😅`
        : `${Math.round(ratio * 100)}% of income spent. Hold off 😅`
    case 'RICH':
      return id
        ? `Surplus ${formatCompactRupiah(monthIncome - monthExpense, language)}. Dompet lagi tebal 💰`
        : `Surplus ${formatCompactRupiah(monthIncome - monthExpense, language)}. Wallet is loaded 💰`
    case 'NEUTRAL':
      if (todayCount === 0) {
        return id
          ? `Bulan ini ${Math.round(ratio * 100)}% pemasukan kepakai. Tetap pantau 👀`
          : `${Math.round(ratio * 100)}% of income spent this month. Keep an eye 👀`
      }
      return id
        ? `Baru ${formatCompactRupiah(todayExpense, language)} keluar hari ini. Tetap pantau 👀`
        : `${formatCompactRupiah(todayExpense, language)} spent today. Keep an eye 👀`
    case 'HAPPY':
      return daily > 0
        ? id
          ? `Aman! Sisa harian ~${formatCompactRupiah(daily, language)}. Boleh santai 😊`
          : `Safe! Daily allowance ~${formatCompactRupiah(daily, language)}. Enjoy 😊`
        : id
          ? 'Dompet sehat. Tetap hemat ya! 💪'
          : 'Wallet healthy. Keep it up! 💪'
  }
}

export interface BuildWidgetPayloadInput {
  transactions: Array<{
    workspace_id?: string | null
    type: 'income' | 'expense'
    amount: number
    category: string
    transaction_date: string
  }>
  workspaceId: string | null
  walletName: string
  language: WidgetLanguage
  now?: Date
  budgets?: Array<{ category: string; amount: number }> // kosong/absen = tanpa budget, runway saja
}

export function buildWidgetPayload(input: BuildWidgetPayloadInput): WidgetPayload {
  const now = input.now ?? new Date()
  const wsTx = input.transactions.filter((t) => {
    if (!input.workspaceId || t.workspace_id !== input.workspaceId) return false
    const date = parseTransactionDate(t.transaction_date)
    return date !== null
      && date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() <= now.getDate()
  })
  const income = wsTx.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)
  const expense = wsTx.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
  const balance = income - expense
  const byCategory = wsTx.reduce<Record<string, number>>((acc, t) => {
    if (t.type === 'expense') acc[t.category] = (acc[t.category] ?? 0) + t.amount
    return acc
  }, Object.create(null) as Record<string, number>)
  const snap: FinancialSnapshot = {
    income,
    expense,
    balance,
    count: wsTx.length,
    byCategory,
    otherWithDesc: [],
    otherNoDesc: 0,
    budgetUtilisation: calcBudgetUtilisation(input.budgets, wsTx),
  }
  const companion = evaluateCompanion(snap, input.language)
  const today = sumTodayExpense(wsTx, now)
  const topCategory = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0]
  return {
    walletName: input.walletName || 'Dompet Bareng',
    todayExpense: today.total,
    todayCount: today.count,
    monthExpense: expense,
    monthIncome: income,
    monthBalance: balance,
    topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
    mood: companion.mood,
    color: companion.color,
    suggestion: getWidgetSuggestion({
      mood: companion.mood,
      language: input.language,
      todayExpense: today.total,
      monthExpense: expense,
      monthIncome: income,
      todayCount: today.count,
      now,
    }),
    language: input.language,
    updatedAt: now.toISOString(),
  }
}

export function refreshWidgetPayload(payload: WidgetPayload, now: Date = new Date()): WidgetPayload {
  const updatedAt = new Date(payload.updatedAt)
  if (!Number.isNaN(updatedAt.getTime()) && updatedAt.toDateString() === now.toDateString()) {
    return payload
  }
  // Cached daily totals are not evidence of today's spending after midnight.
  return buildEmptyWidgetPayload(payload.language, payload.walletName)
}

export function buildEmptyWidgetPayload(language: WidgetLanguage = 'id', walletName = 'Dompet Bareng'): WidgetPayload {
  return {
    walletName,
    todayExpense: 0,
    todayCount: 0,
    monthExpense: 0,
    mood: 'NEUTRAL',
    color: '#3B82F6',
    suggestion: language === 'id' ? 'Buka app untuk memperbarui data.' : 'Open the app to refresh data.',
    language,
    updatedAt: '',
  }
}
