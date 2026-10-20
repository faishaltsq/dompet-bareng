import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  isToday,
  sumTodayExpense,
  formatCompactRupiah,
  getWidgetSuggestion,
  buildWidgetPayload,
  buildEmptyWidgetPayload,
  refreshWidgetPayload,
  type BuildWidgetPayloadInput,
} from '../widgetPayload'

type WidgetTransaction = BuildWidgetPayloadInput['transactions'][number]

function transaction(overrides: Partial<WidgetTransaction> = {}): WidgetTransaction {
  return {
    workspace_id: 'w1', type: 'expense', amount: 200000,
    category: 'Makan', transaction_date: '2026-10-18', ...overrides,
  }
}

function payloadInput(overrides: Partial<BuildWidgetPayloadInput> = {}): BuildWidgetPayloadInput {
  return {
    transactions: [], workspaceId: 'w1', walletName: 'Keluarga', language: 'en',
    now: new Date('2026-10-18T12:00:00'), ...overrides,
  }
}

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
    expect(sumTodayExpense(tx, now)).toEqual({ total: 10000, count: 1 })
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

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('getWidgetSuggestion', () => {
  it.each([
    ['2028-02-27T12:00:00', 'Rp 15K'],
    ['2028-02-28T12:00:00', 'Rp 30K'],
    ['2028-02-29T12:00:00', 'Rp 30K'],
    ['2028-04-20T12:00:00', 'Rp 3K'],
  ])('uses the injected local date for daily allowance: %s', (date, allowance) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00'))
    const s = getWidgetSuggestion({
      mood: 'HAPPY', language: 'en', todayExpense: 1000, todayCount: 1,
      monthExpense: 1000, monthIncome: 31000, now: new Date(date),
    })
    expect(s).toBe(`Safe! Daily allowance ~${allowance}. Enjoy 😊`)
  })

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
  it.each(['id', 'en'] as const)('does not panic on a known empty month (%s)', (language) => {
    const p = buildWidgetPayload(payloadInput({ language }))
    expect(p).toMatchObject({
      todayExpense: 0, todayCount: 0, monthExpense: 0,
      monthIncome: 0, monthBalance: 0, topCategory: null, mood: 'WELCOME',
    })
    expect(p.suggestion).toContain('🎉')
  })

  it('uses null for the top category when the month contains only income', () => {
    const p = buildWidgetPayload(payloadInput({ transactions: [
      transaction({ type: 'income', amount: 250000, category: 'Gaji' }),
    ] }))
    expect(p).toMatchObject({ monthIncome: 250000, monthExpense: 0, monthBalance: 250000, topCategory: null })
  })

  it('does not include transaction descriptions or account identifiers in the summary', () => {
    const privateTransaction = {
      ...transaction(), description: 'private description', user_id: 'private-user', token: 'private-token',
    }
    const p = buildWidgetPayload(payloadInput({ transactions: [privateTransaction] }))
    expect(Object.keys(p).sort()).toEqual([
      'walletName', 'todayExpense', 'todayCount', 'monthExpense', 'monthIncome', 'monthBalance',
      'topCategory', 'mood', 'color', 'suggestion', 'language', 'updatedAt',
    ].sort())
    expect(p.topCategory).toEqual({ name: 'Makan', amount: 200000 })
    expect(JSON.stringify(p)).not.toContain('private')
  })

  it.each(['id', 'en'] as const)('uses monthly context for NEUTRAL advice on a zero-spending day (%s)', (language) => {
    // Pengeluaran dipecah dua supaya tidak ikut memicu aturan "satu transaksi
    // besar" — tes ini soal filter periode, bukan soal pemicu shock.
    const p = buildWidgetPayload(payloadInput({ language, transactions: [
      transaction({ type: 'income', amount: 1000000, transaction_date: '2026-10-01' }),
      transaction({ amount: 300000, transaction_date: '2026-10-17' }),
      transaction({ amount: 300000, transaction_date: '2026-10-17' }),
    ] }))
    expect(p.todayCount).toBe(0)
    expect(p.mood).toBe('NEUTRAL')
    expect(p.suggestion).toBe(language === 'id'
      ? 'Bulan ini 60% pemasukan kepakai. Tetap pantau 👀'
      : '60% of income spent this month. Keep an eye 👀')
    expect(p.suggestion).not.toContain('🎉')
  })

  it.each(['id', 'en'] as const)('keeps WARNING advice when all spending was earlier this month (%s)', (language) => {
    // Dipecah dua supaya WARNING-nya datang dari rasio bulanan, bukan dari
    // pemicu satu transaksi besar.
    const p = buildWidgetPayload(payloadInput({ language, transactions: [
      transaction({ type: 'income', amount: 1000000, transaction_date: '2026-10-01' }),
      transaction({ amount: 400000, transaction_date: '2026-10-17' }),
      transaction({ amount: 400000, transaction_date: '2026-10-17' }),
    ] }))
    expect(p.todayCount).toBe(0)
    expect(p.mood).toBe('WARNING')
    expect(p.suggestion).toBe(language === 'id'
      ? 'Udah 80% pemasukan kepakai. Tahan jajan dulu 😅'
      : '80% of income spent. Hold off 😅')
    expect(p.suggestion).not.toContain('🎉')
  })

  it('exposes monthly details from only valid active-workspace transactions through today', () => {
    const p = buildWidgetPayload(payloadInput({ transactions: [
      transaction({ type: 'income', amount: 100000, transaction_date: '2026-10-01' }),
      transaction({ amount: 120000, category: 'Transport', transaction_date: '2026-10-02' }),
      transaction({ amount: 50000, category: 'Makan' }),
      transaction({ amount: 900000, category: 'Excluded', workspace_id: 'w2' }),
      transaction({ amount: 900000, category: 'Excluded', workspace_id: undefined }),
      transaction({ amount: 900000, category: 'Excluded', transaction_date: '2026-09-18' }),
      transaction({ amount: 900000, category: 'Excluded', transaction_date: '2025-10-18' }),
      transaction({ amount: 900000, category: 'Excluded', transaction_date: '2026-10-19' }),
      transaction({ amount: 900000, category: 'Excluded', transaction_date: '2026-09-31' }),
      transaction({ amount: 900000, category: 'Excluded', transaction_date: '2026-10-18T00:00:00Z' }),
      transaction({ type: 'income', amount: 900000, workspace_id: 'w2' }),
      transaction({ type: 'income', amount: 900000, transaction_date: '2026-10-19' }),
      transaction({ type: 'income', amount: 900000, transaction_date: 'not-a-date' }),
    ] }))
    expect(p).toMatchObject({
      todayExpense: 50000, todayCount: 1, monthExpense: 170000,
      monthIncome: 100000, monthBalance: -70000,
      topCategory: { name: 'Transport', amount: 120000 },
    })
  })

  it.each(['__proto__', 'constructor', 'toString'])('aggregates category names safely: %s', (category) => {
    const p = buildWidgetPayload(payloadInput({ transactions: [
      transaction({ category, amount: 10000 }),
      transaction({ category, amount: 20000 }),
    ] }))
    expect(p.topCategory).toEqual({ name: category, amount: 30000 })
  })

  it('breaks equal monthly category totals by name regardless of transaction order', () => {
    const transactions = [
      transaction({ category: 'Transport', amount: 120000 }),
      transaction({ category: 'Makan', amount: 50000 }),
      transaction({ category: 'Makan', amount: 70000, transaction_date: '2026-10-01' }),
    ]
    for (const rows of [transactions, [...transactions].reverse()]) {
      expect(buildWidgetPayload(payloadInput({ transactions: rows })).topCategory)
        .toEqual({ name: 'Makan', amount: 120000 })
    }
  })

  it.each(['id', 'en'] as const)('keeps PANIC advice ahead of no-spending celebration (%s)', (language) => {
    const p = buildWidgetPayload(payloadInput({ language, transactions: [
      transaction({ type: 'income', amount: 100000, transaction_date: '2026-10-01' }),
      transaction({ amount: 200000, transaction_date: '2026-10-17' }),
    ] }))
    expect(p.todayExpense).toBe(0)
    expect(p.todayCount).toBe(0)
    expect(p.mood).toBe('PANIC')
    expect(p.suggestion).toBe(language === 'id'
      ? '🚨 Pengeluaran lewat pemasukan! Rem sekarang.'
      : '🚨 Spending exceeds income! Stop now.')
    expect(p.suggestion).not.toContain('🎉')
  })

  it('passes its clock to suggestions as well as totals and timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00'))
    const now = new Date('2028-04-20T12:00:00')
    const p = buildWidgetPayload(payloadInput({ now, transactions: [
      transaction({ type: 'income', amount: 31000, transaction_date: '2028-04-01' }),
      transaction({ amount: 1000, transaction_date: '2028-04-20' }),
    ] }))
    expect(p.suggestion).toBe('Safe! Daily allowance ~Rp 3K. Enjoy 😊')
    expect(p.updatedAt).toBe(now.toISOString())
    expect(p.todayExpense).toBe(1000)
  })

  it.each([undefined, null, ''])('excludes transactions without a workspace id: %s', (workspace_id) => {
    const p = buildWidgetPayload(payloadInput({ transactions: [
      transaction({ type: 'income', amount: 1000000 }),
      transaction(),
      transaction({ workspace_id, amount: 2000000 }),
      transaction({ workspace_id: 'w2', amount: 3000000 }),
    ] }))
    expect(p.todayExpense).toBe(200000)
    expect(p.todayCount).toBe(1)
    expect(p.monthExpense).toBe(200000)
    expect(p.mood).toBe('RICH')
  })

  it('does not aggregate any transactions when no workspace is active', () => {
    const p = buildWidgetPayload(payloadInput({ workspaceId: null, transactions: [
      transaction(), transaction({ workspace_id: 'w2' }),
      transaction({ workspace_id: undefined }), transaction({ workspace_id: null }),
    ] }))
    expect(p.todayExpense).toBe(0)
    expect(p.todayCount).toBe(0)
    expect(p.monthExpense).toBe(0)
    expect(p.mood).toBe('WELCOME')
  })

  it.each([
    '2026-09-18', '2025-10-18', '2026-10-19', '2026-11-01',
    'not-a-date', '2026-09-31', '2026-13-01', '2026-10-18T00:00:00Z',
  ])('ignores expense outside the valid current month through today: %s', (date) => {
    const p = buildWidgetPayload(payloadInput({ transactions: [
      transaction({ type: 'income', amount: 1000000, transaction_date: '2026-10-01' }),
      transaction(),
      transaction({ amount: 2000000, transaction_date: date }),
    ] }))
    expect(p.monthExpense).toBe(200000)
    expect(p.todayExpense).toBe(200000)
    expect(p.todayCount).toBe(1)
    expect(p.mood).toBe('RICH')
  })

  it.each(['2026-09-18', '2025-10-18', '2026-10-19', 'not-a-date']) (
    'ignores income outside the valid current month through today: %s', (date) => {
      // Pengeluaran dipecah dua supaya WARNING-nya berasal dari rasio bulanan
      // dan bukan dari pemicu satu transaksi besar — tes ini soal penyaringan
      // tanggal, bukan soal mood.
      const p = buildWidgetPayload(payloadInput({ transactions: [
        transaction({ type: 'income', amount: 1000000, transaction_date: '2026-10-01' }),
        transaction({ amount: 400000 }),
        transaction({ amount: 400000 }),
        transaction({ type: 'income', amount: 10000000, transaction_date: date }),
      ] }))
      expect(p.mood).toBe('WARNING')
      expect(p.suggestion).toContain('80%')
    },
  )

  it('rejects calendar dates that normalize into the current month', () => {
    const p = buildWidgetPayload(payloadInput({
      now: new Date('2026-03-02T12:00:00'),
      transactions: [transaction({ transaction_date: '2026-02-30' })],
    }))
    expect(p.monthExpense).toBe(0)
    expect(p.todayCount).toBe(0)
    expect(p.mood).toBe('WELCOME')
  })

  it('includes earlier current-month expenses without counting them as today', () => {
    const p = buildWidgetPayload(payloadInput({ transactions: [
      transaction({ type: 'income', amount: 1000000, transaction_date: '2026-10-01' }),
      transaction({ amount: 100000, transaction_date: '2026-10-02' }),
      transaction(),
    ] }))
    expect(p.monthExpense).toBe(300000)
    expect(p.todayExpense).toBe(200000)
    expect(p.todayCount).toBe(1)
  })

  it('filters by workspaceId and computes month totals', () => {
    const now = new Date('2026-10-18T12:00:00')
    const tx: WidgetTransaction[] = [
      { workspace_id: 'w1', type: 'income', amount: 1000000, category: 'Gaji', transaction_date: '2026-10-01' },
      { workspace_id: 'w1', type: 'expense', amount: 200000, category: 'Makan', transaction_date: '2026-10-18' },
      { workspace_id: 'w2', type: 'expense', amount: 999, category: 'X', transaction_date: '2026-10-18' },
    ]
    const p = buildWidgetPayload({ transactions: tx, workspaceId: 'w1', walletName: 'Keluarga', language: 'id', now })
    expect(p.walletName).toBe('Keluarga')
    expect(p.todayExpense).toBe(200000)
    expect(p.todayCount).toBe(1)
    expect(p.monthExpense).toBe(200000)
    expect(p.suggestion.length).toBeGreaterThan(0)
    expect(p.updatedAt).toBe(now.toISOString())
  })
  it('sets PANIC mood when expenses exceed income', () => {
    const now = new Date('2026-10-18T12:00:00')
    const tx: WidgetTransaction[] = [
      { workspace_id: 'w1', type: 'income', amount: 100000, category: 'Gaji', transaction_date: '2026-10-01' },
      { workspace_id: 'w1', type: 'expense', amount: 200000, category: 'Makan', transaction_date: '2026-10-18' },
    ]
    const p = buildWidgetPayload({ transactions: tx, workspaceId: 'w1', walletName: 'W', language: 'id', now })
    expect(p.mood).toBe('PANIC')
  })
})

describe('buildWidgetPayload — a single huge transaction', () => {
  it('raises the mood and names the transaction in the suggestion', () => {
    // Gaji 1jt, satu pengeluaran 800rb. Rasio bulanan 80% — dan satu kali
    // itu juga 80% dari gaji, jadi shock ikut menyala.
    const p = buildWidgetPayload(payloadInput({ language: 'id', transactions: [
      transaction({ type: 'income', amount: 1000000, transaction_date: '2026-10-01' }),
      transaction({ amount: 800000, transaction_date: '2026-10-17' }),
    ] }))
    expect(p.mood).toBe('PANIC')
    expect(p.suggestion).toContain('80%')
    expect(p.suggestion).toContain('transaksi')
  })

  it('does not claim spending exceeded income when it did not', () => {
    // Rasio bulanan 75% — "pengeluaran lewat pemasukan" akan berbohong.
    const p = buildWidgetPayload(payloadInput({ language: 'id', transactions: [
      transaction({ type: 'income', amount: 2000000, transaction_date: '2026-10-01' }),
      transaction({ amount: 1500000, transaction_date: '2026-10-17' }),
    ] }))
    expect(p.mood).toBe('PANIC') // satu kali = 75% dari gaji, lewat ambang 70%
    expect(p.suggestion).not.toContain('lewat pemasukan')
  })

  it('keeps the plain overspend wording when spending really does exceed income', () => {
    const p = buildWidgetPayload(payloadInput({ language: 'id', transactions: [
      transaction({ type: 'income', amount: 1000000, transaction_date: '2026-10-01' }),
      transaction({ amount: 2000000, transaction_date: '2026-10-17' }),
    ] }))
    expect(p.mood).toBe('PANIC')
    expect(p.suggestion).toContain('lewat pemasukan')
  })
})

describe('refreshWidgetPayload', () => {
  it('preserves the exact payload on the same local calendar day', () => {
    const p = buildWidgetPayload(payloadInput({
      now: new Date('2026-10-18T00:00:00'), transactions: [transaction()],
    }))
    expect(refreshWidgetPayload(p, new Date('2026-10-18T23:59:59'))).toBe(p)
  })

  it('preserves data across UTC midnight when the local calendar day is unchanged', () => {
    vi.stubEnv('TZ', 'Asia/Jakarta')
    const updatedAt = new Date('2026-10-18T18:00:00Z') // Oct 19, 01:00 local
    const now = new Date('2026-10-19T15:00:00Z') // Oct 19, 22:00 local
    expect(updatedAt.getDate()).toBe(19)
    expect(updatedAt.toISOString().slice(0, 10)).not.toBe(now.toISOString().slice(0, 10))
    const p = buildWidgetPayload(payloadInput({ now: updatedAt }))
    expect(refreshWidgetPayload(p, now)).toBe(p)
  })

  it('expires data at local midnight even when the UTC calendar day is unchanged', () => {
    vi.stubEnv('TZ', 'Asia/Jakarta')
    const updatedAt = new Date('2026-10-18T16:59:59Z') // Oct 18, 23:59 local
    const now = new Date('2026-10-18T17:00:00Z') // Oct 19, 00:00 local
    expect(updatedAt.getDate()).toBe(18)
    expect(now.getDate()).toBe(19)
    expect(updatedAt.toISOString().slice(0, 10)).toBe(now.toISOString().slice(0, 10))
    const p = buildWidgetPayload(payloadInput({ now: updatedAt, transactions: [transaction()] }))
    expect(refreshWidgetPayload(p, now)).toEqual(buildEmptyWidgetPayload('en', 'Keluarga'))
  })

  it.each([
    ['2026-10-31T23:59:59', '2026-11-01T00:00:00'],
    ['2026-12-31T23:59:59', '2027-01-01T00:00:00'],
  ])('expires a stale payload across a month or year rollover: %s', (updatedAt, now) => {
    const p = { ...buildEmptyWidgetPayload('id', 'Keluarga'),
      todayExpense: 12345, updatedAt: new Date(updatedAt).toISOString() }
    expect(refreshWidgetPayload(p, new Date(now))).toEqual(buildEmptyWidgetPayload('id', 'Keluarga'))
  })

  it.each(['', 'not-a-date'])('replaces untrustworthy timestamps with a placeholder: %s', (updatedAt) => {
    const p = { ...buildWidgetPayload(payloadInput({ transactions: [transaction()] })), updatedAt }
    expect(refreshWidgetPayload(p, new Date('2026-10-18T12:00:00')))
      .toEqual(buildEmptyWidgetPayload('en', 'Keluarga'))
  })

  it('keeps an empty payload a neutral placeholder', () => {
    const p = buildEmptyWidgetPayload('id', 'Keluarga')
    expect(refreshWidgetPayload(p, new Date('2026-10-19T12:00:00'))).toEqual(p)
  })

  it('defaults its clock to the current time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T00:00:00'))
    const p = buildWidgetPayload(payloadInput({ transactions: [transaction()] }))
    expect(refreshWidgetPayload(p)).toEqual(buildEmptyWidgetPayload('en', 'Keluarga'))
  })

  it('replaces yesterday spending with a truthful placeholder after local midnight', () => {
    const p = buildWidgetPayload(payloadInput({
      now: new Date('2026-10-18T23:59:59'), transactions: [transaction()],
    }))
    const result = refreshWidgetPayload(p, new Date('2026-10-19T00:00:00'))
    expect(result).toEqual(buildEmptyWidgetPayload('en', 'Keluarga'))
    expect(result.suggestion).toBe('Open the app to refresh data.')
    expect(result.suggestion).not.toContain('🎉')
    expect(p.todayExpense).toBe(200000)
  })
})

describe('buildEmptyWidgetPayload', () => {
  it('leaves monthly details unknown for placeholders and stale data', () => {
    const current = buildWidgetPayload(payloadInput({ transactions: [transaction()] }))
    const stale = refreshWidgetPayload(current, new Date('2026-10-19T12:00:00'))
    for (const p of [buildEmptyWidgetPayload(), stale]) {
      expect(p).not.toHaveProperty('monthIncome')
      expect(p).not.toHaveProperty('monthBalance')
      expect(p).not.toHaveProperty('topCategory')
      expect(p.updatedAt).toBe('')
    }
  })

  it('returns a neutral placeholder', () => {
    const p = buildEmptyWidgetPayload('en', 'X')
    expect(p.mood).toBe('NEUTRAL')
    expect(p.language).toBe('en')
    expect(p.walletName).toBe('X')
  })
})
