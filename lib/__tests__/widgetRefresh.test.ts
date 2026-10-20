import AsyncStorage from '@react-native-async-storage/async-storage'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../supabase'
import { refreshWidgetPayloadFromNetwork } from '../widgetRefresh'
import { LANGUAGE_STORAGE_KEY } from '../storageKeys'

vi.mock('../supabase', () => ({
  supabase: { auth: { getSession: vi.fn() }, from: vi.fn() },
}))
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}))

const USER_ID = 'user-1'
const WS_A = { id: 'ws-a', name: 'Keluarga' }
const WS_B = { id: 'ws-b', name: 'Kantor' }

type Result = { data: unknown; error?: unknown }

/** Builder tiruan Supabase: menumpuk filter lalu menyelesaikan sebagai promise. */
function query(result: Result) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'limit', 'gte']) {
    chain[method] = vi.fn(() => chain)
  }
  chain.then = (onFulfilled: unknown, onRejected: unknown) =>
    Promise.resolve(result).then(onFulfilled as never, onRejected as never)
  return chain as Promise<unknown> & Record<string, ReturnType<typeof vi.fn>>
}

function mockTables(results: { memberships?: Result; transactions?: Result; workspaceBudgets?: Result }) {
  const tables: Record<string, ReturnType<typeof query>> = {}
  if (results.memberships) tables.workspace_members = query(results.memberships)
  if (results.transactions) tables.transactions = query(results.transactions)
  if (results.workspaceBudgets) tables.workspace_budgets = query(results.workspaceBudgets)
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const found = tables[table]
    if (!found) throw new Error(`unexpected table: ${table}`)
    return found as never
  })
  return tables
}

function signIn(id = USER_ID) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id } } },
  } as never)
}

const NOW = new Date('2026-10-20T03:00:00')

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(AsyncStorage.getItem).mockResolvedValue(null)
})

describe('refreshWidgetPayloadFromNetwork', () => {
  it('builds a payload from the active wallet’s transactions', async () => {
    signIn()
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) =>
      key === `@db:active_workspace:${USER_ID}` ? WS_A.id : null)
    mockTables({
      memberships: { data: [{ workspaces: WS_A }, { workspaces: WS_B }] },
      transactions: {
        data: [
          { workspace_id: WS_A.id, type: 'expense', amount: 25000, category: 'Makan', transaction_date: '2026-10-20' },
          { workspace_id: WS_A.id, type: 'expense', amount: 15000, category: 'Transport', transaction_date: '2026-10-19' },
          { workspace_id: WS_A.id, type: 'income', amount: 200000, category: 'Gaji', transaction_date: '2026-10-01' },
          { workspace_id: WS_A.id, type: 'expense', amount: 90000, category: 'Belanja', transaction_date: '2026-09-15' },
        ],
        error: null,
      },
      workspaceBudgets: { data: [{ category: 'Makan', amount: 100000 }], error: null },
    })

    const payload = await refreshWidgetPayloadFromNetwork(NOW)

    expect(payload).not.toBeNull()
    expect(payload).toMatchObject({
      walletName: 'Keluarga',
      todayExpense: 25000,
      todayCount: 1,
      // 90000 tertanggal 2026-09-15 ikut terbaca dari API tapi wajib gugur di
      // penyaringan bulan berjalan — sama persis dengan perilaku aplikasi.
      monthExpense: 40000,
      monthIncome: 200000,
      updatedAt: NOW.toISOString(),
    })
  })

  it('returns null when nobody is signed in', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never)

    await expect(refreshWidgetPayloadFromNetwork(NOW)).resolves.toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns null when the membership query fails', async () => {
    signIn()
    mockTables({ memberships: { data: null, error: { message: 'boom' } } })

    await expect(refreshWidgetPayloadFromNetwork(NOW)).resolves.toBeNull()
  })

  it('returns null when the user has no wallet', async () => {
    signIn()
    mockTables({ memberships: { data: [], error: null } })

    await expect(refreshWidgetPayloadFromNetwork(NOW)).resolves.toBeNull()
  })

  it('returns null when the transaction query fails', async () => {
    signIn()
    mockTables({
      memberships: { data: [{ workspaces: WS_A }] },
      transactions: { data: null, error: { message: 'boom' } },
      workspaceBudgets: { data: [], error: null },
    })

    await expect(refreshWidgetPayloadFromNetwork(NOW)).resolves.toBeNull()
  })

  it('falls back to the first wallet when the saved one no longer exists', async () => {
    signIn()
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) =>
      key === `@db:active_workspace:${USER_ID}` ? 'ws-gone' : null)
    mockTables({
      memberships: { data: [{ workspaces: [WS_A, WS_B] }] },
      transactions: { data: [], error: null },
      workspaceBudgets: { data: [], error: null },
    })

    const payload = await refreshWidgetPayloadFromNetwork(NOW)

    expect(payload?.walletName).toBe('Keluarga')
  })

  it('resolves the one-to-many relation when it arrives as a single object', async () => {
    signIn()
    mockTables({
      memberships: { data: [{ workspaces: WS_B }] },
      transactions: { data: [], error: null },
      workspaceBudgets: { data: [], error: null },
    })

    const payload = await refreshWidgetPayloadFromNetwork(NOW)

    expect(payload?.walletName).toBe('Kantor')
  })

  it('uses the stored app language instead of always defaulting to Indonesian', async () => {
    signIn()
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) =>
      key === LANGUAGE_STORAGE_KEY ? 'en' : null)
    mockTables({
      memberships: { data: [{ workspaces: WS_A }] },
      transactions: { data: [], error: null },
      workspaceBudgets: { data: [], error: null },
    })

    const payload = await refreshWidgetPayloadFromNetwork(NOW)

    expect(payload?.language).toBe('en')
    expect(payload?.suggestion).not.toContain('Buka app')
  })

  it('returns null instead of throwing when the underlying query throws', async () => {
    signIn()
    vi.mocked(supabase.from).mockImplementation((() => { throw new Error('offline') }) as never)

    await expect(refreshWidgetPayloadFromNetwork(NOW)).resolves.toBeNull()
  })
})
