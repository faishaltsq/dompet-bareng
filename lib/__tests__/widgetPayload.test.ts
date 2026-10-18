import { describe, it, expect } from 'vitest'
import {
  isToday,
  sumTodayExpense,
  formatCompactRupiah,
  getWidgetSuggestion,
  buildWidgetPayload,
  buildEmptyWidgetPayload,
} from '../widgetPayload'

describe('isToday', () => {
  it('returns true for today and false for other day', () => {
    const today = new Date('2026-10-18T12:00:00')
    expect(isToday('2026-10-18', today)).toBe(true)
    expect(isToday('2026-10-17', today)).toBe(false)
    expect(isToday('not-a-date', today)).toBe(false)
  })
})

describe('sumTodayExpense', () => {
  it('sums only expense rows dated today', () => {
    const now = new Date('2026-10-18T12:00:00')
    const tx = [
      { type: 'expense', amount: 10000, transaction_date: '2026-10-18' },
      { type: 'income', amount: 50000, transaction_date: '2026-10-18' },
      { type: 'expense', amount: 9999, transaction_date: '2026-10-17' },
    ]
    expect(sumTodayExpense(tx as any, now)).toEqual({ total: 10000, count: 1 })
  })
})

describe('formatCompactRupiah', () => {
  it('formats small amounts plainly', () => {
    expect(formatCompactRupiah(0, 'id')).toBe('Rp 0')
    expect(formatCompactRupiah(999, 'id')).toBe('Rp 999')
  })
  it('uses rb for thousands (id)', () => {
    expect(formatCompactRupiah(1000, 'id')).toBe('Rp 1rb')
    expect(formatCompactRupiah(125000, 'id')).toBe('Rp 125rb')
  })
  it('uses jt for millions (id)', () => {
    expect(formatCompactRupiah(1500000, 'id')).toBe('Rp 1,5jt')
    expect(formatCompactRupiah(2000000, 'id')).toBe('Rp 2jt')
  })
  it('uses K/M for en', () => {
    expect(formatCompactRupiah(125000, 'en')).toBe('Rp 125K')
    expect(formatCompactRupiah(1500000, 'en')).toBe('Rp 1,5M')
  })
  it('prefixes minus for negative', () => {
    expect(formatCompactRupiah(-5000, 'id')).toBe('-Rp 5rb')
  })
})

describe('getWidgetSuggestion', () => {
  it('returns zero-spending message when nothing spent today', () => {
    const s = getWidgetSuggestion({ mood: 'HAPPY', language: 'id', todayExpense: 0, monthExpense: 100, monthIncome: 1000, todayCount: 0 })
    expect(s).toContain('Belum ada pengeluaran')
  })
  it('returns English when language en', () => {
    const s = getWidgetSuggestion({ mood: 'HAPPY', language: 'en', todayExpense: 0, monthExpense: 100, monthIncome: 1000, todayCount: 0 })
    expect(s).toContain('No spending')
  })
  it('PANIC message contains alarm', () => {
    const s = getWidgetSuggestion({ mood: 'PANIC', language: 'id', todayExpense: 500, monthExpense: 2000, monthIncome: 1000, todayCount: 2 })
    expect(s).toContain('🚨')
  })
  it('HAPPY with income mentions daily allowance', () => {
    const s = getWidgetSuggestion({ mood: 'HAPPY', language: 'id', todayExpense: 100, monthExpense: 100, monthIncome: 1000, todayCount: 1 })
    expect(s).toContain('Sisa harian')
  })
})

describe('buildWidgetPayload', () => {
  it('filters by workspaceId and computes month totals', () => {
    const now = new Date('2026-10-18T12:00:00')
    const tx = [
      { workspace_id: 'w1', type: 'income', amount: 1000000, category: 'Gaji', transaction_date: '2026-10-01' },
      { workspace_id: 'w1', type: 'expense', amount: 200000, category: 'Makan', transaction_date: '2026-10-18' },
      { workspace_id: 'w2', type: 'expense', amount: 999, category: 'X', transaction_date: '2026-10-18' },
    ]
    const p = buildWidgetPayload({ transactions: tx as any, workspaceId: 'w1', walletName: 'Keluarga', language: 'id', now })
    expect(p.walletName).toBe('Keluarga')
    expect(p.todayExpense).toBe(200000)
    expect(p.todayCount).toBe(1)
    expect(p.monthExpense).toBe(200000)
    expect(p.suggestion.length).toBeGreaterThan(0)
    expect(p.updatedAt).toBe(now.toISOString())
  })
  it('sets PANIC mood when expenses exceed income', () => {
    const now = new Date('2026-10-18T12:00:00')
    const tx = [
      { workspace_id: 'w1', type: 'income', amount: 100000, category: 'Gaji', transaction_date: '2026-10-01' },
      { workspace_id: 'w1', type: 'expense', amount: 200000, category: 'Makan', transaction_date: '2026-10-18' },
    ]
    const p = buildWidgetPayload({ transactions: tx as any, workspaceId: 'w1', walletName: 'W', language: 'id', now })
    expect(p.mood).toBe('PANIC')
  })
})

describe('buildEmptyWidgetPayload', () => {
  it('returns a neutral placeholder', () => {
    const p = buildEmptyWidgetPayload('en', 'X')
    expect(p.mood).toBe('NEUTRAL')
    expect(p.language).toBe('en')
    expect(p.walletName).toBe('X')
  })
})
