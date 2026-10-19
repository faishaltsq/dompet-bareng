import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { evaluateCompanion, type FinancialSnapshot } from '../companion'

/**
 * `calcSafeDays` membaca tanggal nyata (Math.max(day, 3)), jadi seluruh suite
 * ini dikunci ke satu tanggal supaya runway-nya deterministik. 18 Oktober →
 * pembagi harian = 18.
 */
const FIXED_NOW = new Date('2026-10-18T12:00:00')

function snap(overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    income: 0, expense: 0, balance: 0, count: 0,
    byCategory: {}, ...overrides,
  }
}

/** runway = floor(balance * 18 / expense) pada tanggal yang dikunci di atas */
function moodOf(overrides: Partial<FinancialSnapshot>) {
  return evaluateCompanion(snap({ count: 1, ...overrides })).mood
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('evaluateCompanion — the eight-member priority chain', () => {
  it('greets an untouched workspace instead of calling it healthy', () => {
    // `count === 0` menang walaupun angka-angkanya nol-nol terlihat "sehat".
    expect(evaluateCompanion(snap()).mood).toBe('WELCOME')
    // ...dan menang walaupun dompetnya penuh — belum ada apa-apa untuk dinilai.
    expect(evaluateCompanion(snap({
      income: 4_000_000, expense: 1_000_000, balance: 3_000_000,
    })).mood).toBe('WELCOME')
  })

  it('does not scream PANIC when income was simply never recorded', () => {
    // expenseRatio() mengembalikan 2 untuk kasus ini dan balance-nya juga minus —
    // tanpa guard THINKING, pengguna baru disambut otter menjerit.
    const state = evaluateCompanion(snap({
      income: 0, expense: 150_000, balance: -150_000, count: 3,
    }))
    expect(state.mood).toBe('THINKING')
  })

  it('lets PANIC win over REMINDER when both are lit', () => {
    expect(moodOf({ income: 1_000_000, expense: 1_200_000, balance: -200_000 })).toBe('PANIC')
  })

  it('surfaces REMINDER for a short runway inside the healthy band', () => {
    // rasio 0,4 (sehat) tapi runway tinggal 1 hari — ini yang membuatnya berguna.
    expect(moodOf({ income: 4_000_000, expense: 1_600_000, balance: 100_000 })).toBe('REMINDER')
  })

  it('keeps the legacy bands untouched', () => {
    expect(moodOf({ income: 4_000_000, expense: 2_400_000, balance: 1_600_000 })).toBe('NEUTRAL') // 0,6
    expect(moodOf({ income: 4_000_000, expense: 3_000_000, balance: 2_000_000 })).toBe('WARNING') // 0,75
    expect(moodOf({ income: 4_000_000, expense: 1_600_000, balance: 3_000_000 })).toBe('HAPPY') // 0,4
  })

  it('gives RICH a genuine surplus, not merely a small ratio', () => {
    expect(moodOf({ income: 4_000_000, expense: 1_000_000, balance: 3_000_000 })).toBe('RICH')
    // rasio 0,25 sempurna tapi surplus Rp 300rb di bawah lantai → bukan RICH.
    expect(moodOf({ income: 400_000, expense: 100_000, balance: 300_000 })).toBe('HAPPY')
    // income kecil tidak dihadiahi kantong uang karena rasionya bagus.
    expect(moodOf({ income: 200_000, expense: 50_000, balance: 150_000 })).toBe('HAPPY')
  })
})

describe('evaluateCompanion — labels follow the mood', () => {
  it.each([
    ['WELCOME', { count: 0 }],
    ['THINKING', { count: 3, income: 0, expense: 150_000, balance: -150_000 }],
    ['PANIC', { count: 3, income: 1_000_000, expense: 1_200_000, balance: -200_000 }],
    ['REMINDER', { count: 3, income: 4_000_000, expense: 1_600_000, balance: 100_000 }],
    ['WARNING', { count: 3, income: 4_000_000, expense: 3_000_000, balance: 2_000_000 }],
    ['RICH', { count: 3, income: 4_000_000, expense: 1_000_000, balance: 3_000_000 }],
    ['NEUTRAL', { count: 3, income: 4_000_000, expense: 2_400_000, balance: 1_600_000 }],
    ['HAPPY', { count: 3, income: 4_000_000, expense: 1_600_000, balance: 3_000_000 }],
  ] as const)('%s carries a mood label in both languages', (mood, overrides) => {
    const state = evaluateCompanion(snap({ ...overrides }))
    expect(state.mood).toBe(mood)
    expect(state.moodLabel.length).toBeGreaterThan(0)
    expect(evaluateCompanion(snap({ ...overrides }), 'en').moodLabel.length).toBeGreaterThan(0)
  })
})
