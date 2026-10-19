import AsyncStorage from '@react-native-async-storage/async-storage'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildEmptyWidgetPayload, WIDGET_STORAGE_KEY, type WidgetPayload } from '../widgetPayload'
import { readWidgetPayload, writeWidgetPayload } from '../widgetStore'

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}))

function payload(overrides: Partial<WidgetPayload> = {}): WidgetPayload {
  return {
    walletName: 'Keluarga',
    todayExpense: 12500.5,
    todayCount: 2,
    monthExpense: 250000,
    mood: 'HAPPY',
    color: '#1CAB68',
    suggestion: 'Keep it up!',
    language: 'en',
    updatedAt: '2026-10-18T05:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.mocked(AsyncStorage.getItem).mockReset().mockImplementation(async (key) => storage.get(key) ?? null)
  vi.mocked(AsyncStorage.setItem).mockReset().mockImplementation(async (key, value) => {
    storage.set(key, value)
  })
})

describe('widget payload storage', () => {
  it('roundtrips a valid payload through the widget storage key', async () => {
    const expected = payload()
    await writeWidgetPayload(expected)

    await expect(readWidgetPayload()).resolves.toEqual(expected)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(WIDGET_STORAGE_KEY, JSON.stringify(expected))
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(WIDGET_STORAGE_KEY)
  })

  it.each([
    { monthIncome: 0, monthBalance: -250000, topCategory: { name: 'Makan', amount: 250000 } },
    { monthIncome: 500000.5, monthBalance: 250000.5, topCategory: null },
    { monthIncome: 0 }, { monthBalance: 0 }, { topCategory: { name: 'Transport', amount: 0 } },
  ])('roundtrips valid optional monthly details: %j', async (details) => {
    const expected = payload(details)
    await writeWidgetPayload(expected)
    await expect(readWidgetPayload()).resolves.toEqual(expected)
  })

  it('keeps a legacy 1.1.0 cache valid without inventing monthly details', async () => {
    const legacy = payload()
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(legacy))
    const actual = await readWidgetPayload()
    expect(actual).toEqual(legacy)
    expect(actual).not.toHaveProperty('monthIncome')
    expect(actual).not.toHaveProperty('monthBalance')
    expect(actual).not.toHaveProperty('topCategory')
  })

  describe.each(['monthIncome', 'monthBalance'])('optional %s validation', (field) => {
    it.each(['12500', null, true, {}, [], Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      'rejects present invalid numeric detail: %j', async (value) => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({ ...payload(), [field]: value }))
        await expect(readWidgetPayload()).resolves.toBeNull()
      },
    )

    it.each(['1e400', '-1e400'])('rejects non-finite JSON numeric detail: %s', async (overflow) => {
      const raw = JSON.stringify({ ...payload(), [field]: 'OVERFLOW' }).replace('"OVERFLOW"', overflow)
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(raw)
      await expect(readWidgetPayload()).resolves.toBeNull()
    })
  })

  it('rejects negative monthly income while allowing a signed monthly balance', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({ ...payload(), monthIncome: -1 }))
    await expect(readWidgetPayload()).resolves.toBeNull()
  })

  it.each([
    {}, [], 'Makan', 1, true,
    { name: 'Makan' }, { amount: 100 },
    { name: 1, amount: 100 }, { name: null, amount: 100 },
    { name: '', amount: 100 }, { name: '   ', amount: 100 },
    ...[-1, '100', null, true, {}, [], Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
      .map((amount) => ({ name: 'Makan', amount })),
  ].map((topCategory) => [topCategory]))('rejects corrupt optional topCategory: %j', async (topCategory) => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({ ...payload(), topCategory }))
    await expect(readWidgetPayload()).resolves.toBeNull()
  })

  it.each(['1e400', '-1e400'])('rejects non-finite category amount in raw JSON: %s', async (overflow) => {
    const raw = JSON.stringify({ ...payload(), topCategory: { name: 'Makan', amount: 'OVERFLOW' } })
      .replace('"OVERFLOW"', overflow)
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(raw)
    await expect(readWidgetPayload()).resolves.toBeNull()
  })

  it('roundtrips the empty placeholder with its empty updatedAt', async () => {
    const expected = buildEmptyWidgetPayload()
    await writeWidgetPayload(expected)

    await expect(readWidgetPayload()).resolves.toEqual(expected)
  })

  it.each(['HAPPY', 'NEUTRAL', 'WARNING', 'PANIC'] as const)('accepts the valid mood %s', async (mood) => {
    const expected = payload({ mood, language: 'id', color: '#abcdef' })
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(expected))

    await expect(readWidgetPayload()).resolves.toEqual(expected)
  })

  it('accepts zero amounts and the maximum safe integer count', async () => {
    const expected = payload({ todayExpense: 0, monthExpense: 0, todayCount: Number.MAX_SAFE_INTEGER })
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(expected))

    await expect(readWidgetPayload()).resolves.toEqual(expected)
  })

  it('returns null when no value is stored', async () => {
    await expect(readWidgetPayload()).resolves.toBeNull()
  })

  it.each(['', '{', '{"walletName":', 'undefined'])('returns null for malformed or empty storage: %s', async (raw) => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(raw)

    await expect(readWidgetPayload()).resolves.toBeNull()
  })

  it.each(['{}', 'null', '"text"', '[]', '42', 'true'])('returns null for the wrong JSON shape: %s', async (raw) => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(raw)

    await expect(readWidgetPayload()).resolves.toBeNull()
  })

  it.each(Object.keys(payload()))('returns null when required field %s is missing', async (field) => {
    const incomplete: Record<string, unknown> = { ...payload() }
    delete incomplete[field]
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(incomplete))

    await expect(readWidgetPayload()).resolves.toBeNull()
  })

  it.each([
    ['walletName', null], ['walletName', 1],
    ['suggestion', null], ['suggestion', {}],
    ['updatedAt', null], ['updatedAt', 123], ['updatedAt', 'not-a-date'],
    ['mood', 'happy'], ['mood', 'UNKNOWN'], ['mood', null],
    ['language', 'fr'], ['language', null],
    ['color', '#fff'], ['color', '#12345678'], ['color', '123456'],
    ['color', '#GGGGGG'], ['color', 'red'], ['color', null],
  ])('returns null for invalid %s: %j', async (field, value) => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({ ...payload(), [field]: value }))

    await expect(readWidgetPayload()).resolves.toBeNull()
  })

  describe.each(['todayExpense', 'monthExpense'])('%s validation', (field) => {
    it.each([-1, '12500', null, true, {}, [], Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      'returns null for a negative, nonnumeric, or non-finite amount: %j', async (value) => {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({ ...payload(), [field]: value }))

        await expect(readWidgetPayload()).resolves.toBeNull()
      },
    )

    it.each(['1e400', '-1e400'])('returns null for JSON numeric overflow: %s', async (overflow) => {
      // JSON.stringify turns Infinity into null; a numeric token tests the finite-number guard itself.
      const raw = JSON.stringify({ ...payload(), [field]: 'OVERFLOW' }).replace('"OVERFLOW"', overflow)
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(raw)

      await expect(readWidgetPayload()).resolves.toBeNull()
    })
  })

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '2', null, true])('returns null for an invalid count: %j', async (todayCount) => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({ ...payload(), todayCount }))

    await expect(readWidgetPayload()).resolves.toBeNull()
  })

  it('returns null when AsyncStorage rejects a read', async () => {
    vi.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('Storage unavailable'))

    await expect(readWidgetPayload()).resolves.toBeNull()
  })

  it('keeps writes best effort when AsyncStorage rejects a write', async () => {
    vi.mocked(AsyncStorage.setItem).mockRejectedValue(new Error('Storage unavailable'))

    await expect(writeWidgetPayload(payload())).resolves.toBeUndefined()
  })
})
