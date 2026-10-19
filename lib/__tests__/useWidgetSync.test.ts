import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuildWidgetPayloadInput, WidgetPayload } from '../widgetPayload'

// No renderer dependency: retain refs and run real effect callbacks/cleanups.
// This models dependency changes and effect replay, not React/device rendering.
const harness = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  refIndex: 0,
  effect: undefined as undefined | {
    callback: () => void | (() => void)
    deps: readonly unknown[]
    cleanup?: void | (() => void)
  },
  pending: undefined as undefined | (() => void),
  auth: { user: { id: 'u1' } as { id: string } | null, session: {} as object | null, loading: false },
  workspace: {
    activeWorkspace: { id: 'w1', name: 'Family' } as { id: string; name: string } | null,
    transactions: [] as BuildWidgetPayloadInput['transactions'],
  },
  language: 'en' as 'en' | 'id',
  platform: { OS: 'android' },
  listeners: new Set<(state: string) => void>(),
  remove: vi.fn(),
  addEventListener: vi.fn(),
  write: vi.fn<(payload: WidgetPayload) => Promise<void>>(),
  update: vi.fn<(options: {
    widgetName: string
    renderWidget: (info: { width: number; height: number }) => ReactElement
  }) => Promise<void>>(),
}))

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useRef: (value: unknown) => {
    const index = harness.refIndex++
    return harness.refs[index] ?? (harness.refs[index] = { current: value })
  },
  useEffect: (callback: () => void | (() => void), deps: readonly unknown[]) => {
    const previous = harness.effect
    if (previous && deps.length === previous.deps.length
      && deps.every((dep, index) => Object.is(dep, previous.deps[index]))) return
    harness.pending = () => {
      previous?.cleanup?.()
      harness.effect = { callback, deps, cleanup: callback() }
    }
  },
}))
vi.mock('react-native', () => ({
  Platform: harness.platform,
  AppState: { addEventListener: harness.addEventListener },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => harness.auth }))
vi.mock('@/context/WorkspaceContext', () => ({ useWorkspace: () => harness.workspace }))
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ language: harness.language }) }))
vi.mock('@/lib/widgetStore', () => ({ writeWidgetPayload: harness.write }))
vi.mock('react-native-android-widget', () => ({
  requestWidgetUpdate: harness.update,
  FlexWidget: 'FlexWidget', ImageWidget: 'ImageWidget',
  OverlapWidget: 'OverlapWidget', TextWidget: 'TextWidget',
}))

import { useWidgetSync } from '../../hooks/useWidgetSync'
import { buildEmptyWidgetPayload, buildWidgetPayload } from '../widgetPayload'
import { OtterWidget } from '../../widgets/OtterWidget'

function render() {
  harness.refIndex = 0
  useWidgetSync()
  const pending = harness.pending
  harness.pending = undefined
  pending?.()
}

function unmount() {
  harness.effect?.cleanup?.()
  harness.effect = undefined
}

async function flushQueue() {
  // Drain the short serialized promise chain without advancing the clock/timers.
  for (let i = 0; i < 40; i++) await Promise.resolve()
}

function emit(state: string) {
  for (const listener of harness.listeners) listener(state)
}

function expense(workspace_id = 'w1', amount = 12000): BuildWidgetPayloadInput['transactions'][number] {
  return { workspace_id, type: 'expense', amount, category: 'Food', transaction_date: '2026-10-18' }
}

function lastPayload() {
  return harness.write.mock.calls.at(-1)?.[0]
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.stubEnv('TZ', 'Asia/Jakarta')
  vi.setSystemTime(new Date('2026-10-18T12:00:00'))
  harness.refs = []
  harness.refIndex = 0
  harness.effect = undefined
  harness.pending = undefined
  harness.auth = { user: { id: 'u1' }, session: {}, loading: false }
  harness.workspace = { activeWorkspace: { id: 'w1', name: 'Family' }, transactions: [] }
  harness.language = 'en'
  harness.platform.OS = 'android'
  harness.listeners.clear()
  harness.write.mockResolvedValue(undefined)
  harness.update.mockResolvedValue(undefined)
  harness.addEventListener.mockImplementation((event: string, listener: (state: string) => void) => {
    expect(event).toBe('change')
    harness.listeners.add(listener)
    return { remove: () => { harness.listeners.delete(listener); harness.remove() } }
  })
})

afterEach(async () => {
  await flushQueue()
  const providerNames = ['OtterWidgetSmall', 'OtterWidget', 'OtterWidgetLarge']
  expect(harness.update).toHaveBeenCalledTimes(harness.write.mock.calls.length * providerNames.length)
  harness.write.mock.calls.forEach(([payload], index) => {
    const batch = harness.update.mock.calls.slice(index * providerNames.length, (index + 1) * providerNames.length)
    expect(batch.map(([options]) => options.widgetName)).toEqual(providerNames)
    for (const [options] of batch) {
      expect(options.renderWidget({ width: 110, height: 250 }).props).toEqual({
        payload, widthDp: 110, heightDp: 250,
      })
    }
  })
  unmount()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('useWidgetSync', () => {
  it.each(['ios', 'web'])('does no storage/native work outside Android (%s)', async (os) => {
    harness.platform.OS = os
    render()
    await flushQueue()
    expect(harness.write).not.toHaveBeenCalled()
    expect(harness.update).not.toHaveBeenCalled()
    expect(harness.addEventListener).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('syncs real authenticated workspace totals and forwards raw DP dimensions', async () => {
    harness.workspace.transactions = [expense(), expense('w2', 99999)]
    render()
    await flushQueue()
    expect(lastPayload()).toEqual(buildWidgetPayload({
      transactions: harness.workspace.transactions, workspaceId: 'w1', walletName: 'Family',
      language: 'en', now: new Date(),
    }))
    expect(harness.update.mock.calls.map(([options]) => options.widgetName))
      .toEqual(['OtterWidgetSmall', 'OtterWidget', 'OtterWidgetLarge'])
    for (const [options] of harness.update.mock.calls) {
      const element = options.renderWidget({ width: 317.5, height: 161.25 })
      expect(element.type).toBe(OtterWidget)
      expect(element.props).toEqual({ payload: lastPayload(), widthDp: 317.5, heightDp: 161.25 })
    }
  })

  it.each(['session', 'user', 'loading', 'workspace'] as const)('clears stale data when %s is unavailable', async (missing) => {
    harness.workspace.transactions = [expense()]
    render()
    await flushQueue()
    if (missing === 'session') harness.auth.session = null
    if (missing === 'user') harness.auth.user = null
    if (missing === 'loading') harness.auth.loading = true
    if (missing === 'workspace') harness.workspace.activeWorkspace = null
    render()
    await flushQueue()
    expect(lastPayload()).toEqual(buildEmptyWidgetPayload('en'))
    expect(harness.update).toHaveBeenCalledTimes(6)
  })

  it('serializes workspace/account changes behind in-flight writes with the latest payload last', async () => {
    let release!: () => void
    harness.write.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve }))
    harness.workspace.transactions = [expense(), expense('w2', 34000)]
    render()
    await flushQueue()
    harness.workspace.activeWorkspace = { id: 'w2', name: 'Personal' }
    render()
    harness.auth = { user: { id: 'u2' }, session: {}, loading: false }
    harness.workspace.activeWorkspace = { id: 'w3', name: 'New account' }
    harness.workspace.transactions = [expense('w3', 56000)]
    render()
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(1)
    release()
    await flushQueue()
    expect(lastPayload()).toMatchObject({ walletName: 'New account', todayExpense: 56000 })
    const options = harness.update.mock.calls.at(-1)![0]
    expect(options.renderWidget({ width: 320, height: 160 }).props).toMatchObject({ payload: lastPayload() })
  })

  it('finishes an in-flight authenticated write before clearing on sign-out', async () => {
    let release!: () => void
    harness.write.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve }))
    harness.workspace.transactions = [expense()]
    render()
    await flushQueue()
    harness.auth.session = null
    render()
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(1)
    release()
    await flushQueue()
    expect(lastPayload()).toEqual(buildEmptyWidgetPayload('en'))
    const options = harness.update.mock.calls.at(-1)![0]
    expect(options.renderWidget({ width: 320, height: 160 }).props).toMatchObject({
      payload: buildEmptyWidgetPayload('en'),
    })
  })

  it('does not deduplicate a new user or workspace with otherwise identical payloads', async () => {
    render()
    await flushQueue()
    harness.auth = { user: { id: 'u2' }, session: {}, loading: false }
    render()
    await flushQueue()
    harness.workspace.activeWorkspace = { id: 'w2', name: 'Family' }
    render()
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(3)
  })

  it('clears and restores all presets when the same user loses and regains a session', async () => {
    harness.workspace.transactions = [expense()]
    render()
    await flushQueue()
    harness.auth.session = null
    render()
    await flushQueue()
    expect(lastPayload()).toEqual(buildEmptyWidgetPayload('en'))
    harness.auth.session = {}
    render()
    await flushQueue()
    expect(lastPayload()).toMatchObject({ walletName: 'Family', todayExpense: 12000 })
    expect(harness.write).toHaveBeenCalledTimes(3)
  })

  it('updates every preset when transactions change within the same workspace', async () => {
    render()
    await flushQueue()
    harness.workspace.transactions = [expense()]
    render()
    await flushQueue()
    expect(lastPayload()).toMatchObject({ walletName: 'Family', todayExpense: 12000, todayCount: 1 })
    expect(harness.write).toHaveBeenCalledTimes(2)
  })

  it('updates localized payloads when language changes', async () => {
    render()
    await flushQueue()
    harness.language = 'id'
    render()
    await flushQueue()
    expect(lastPayload()).toMatchObject({ language: 'id', suggestion: 'Belum ada pengeluaran hari ini. Mantap! 🎉' })
  })

  it('deduplicates identical same-day data even when updatedAt changes', async () => {
    render()
    await flushQueue()
    vi.setSystemTime(new Date('2026-10-18T15:00:00'))
    harness.workspace.transactions = []
    render()
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(1)
    expect(harness.update).toHaveBeenCalledTimes(3)
  })

  it('refreshes unchanged zero-spend data across local midnight, not UTC midnight', async () => {
    vi.setSystemTime(new Date('2026-10-18T23:59:59'))
    const before = new Date()
    render()
    await flushQueue()
    vi.setSystemTime(new Date('2026-10-19T00:00:00'))
    expect(new Date().toISOString().slice(0, 10)).toBe(before.toISOString().slice(0, 10))
    harness.workspace.transactions = []
    render()
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(2)
    expect(lastPayload()).toMatchObject({ todayExpense: 0, todayCount: 0, updatedAt: new Date().toISOString() })
  })

  it('refreshes with a fresh local date on foreground without changed props', async () => {
    harness.workspace.transactions = [expense()]
    render()
    await flushQueue()
    expect(lastPayload()?.todayExpense).toBe(12000)
    vi.setSystemTime(new Date('2026-10-19T00:00:00'))
    emit('background')
    emit('inactive')
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(1)
    emit('active')
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(2)
    expect(lastPayload()).toMatchObject({
      todayExpense: 0, todayCount: 0, monthExpense: 12000, updatedAt: new Date().toISOString(),
    })
    emit('active')
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(2)
    unmount()
    expect(harness.remove).toHaveBeenCalledTimes(1)
    expect(harness.listeners.size).toBe(0)
  })

  it('refreshes at each local midnight with one timer and cleans up timers/listeners', async () => {
    vi.setSystemTime(new Date('2026-10-18T23:59:59'))
    render()
    await flushQueue()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(999)
    expect(harness.write).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(2)
    expect(lastPayload()?.updatedAt).toBe(new Date('2026-10-19T00:00:00').toISOString())
    expect(vi.getTimerCount()).toBe(1)
    const nextMidnight = new Date()
    nextMidnight.setHours(24, 0, 0, 0)
    await vi.advanceTimersByTimeAsync(nextMidnight.getTime() - Date.now())
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(3)
    expect(lastPayload()?.updatedAt).toBe(new Date('2026-10-20T00:00:00').toISOString())
    harness.language = 'id'
    render()
    await flushQueue()
    expect(harness.remove).toHaveBeenCalledTimes(1)
    expect(harness.listeners.size).toBe(1)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(harness.remove).toHaveBeenCalledTimes(2)
    expect(harness.listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    const writes = harness.write.mock.calls.length
    emit('active')
    await vi.advanceTimersByTimeAsync(2 * 24 * 60 * 60 * 1000)
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(writes)
  })

  it('handles native rejection and continues processing subsequent updates', async () => {
    harness.update.mockRejectedValueOnce(new Error('Native module unavailable'))
    render()
    await flushQueue()
    harness.language = 'id'
    render()
    await flushQueue()
    expect(harness.update).toHaveBeenCalledTimes(6)
    expect(lastPayload()?.language).toBe('id')
  })

  it.each(['OtterWidgetSmall', 'OtterWidget', 'OtterWidgetLarge'])('isolates rejection of %s from all other providers and later updates', async (failedProvider) => {
    harness.update.mockImplementation(async ({ widgetName }) => {
      if (widgetName === failedProvider) throw new Error('Provider unavailable')
    })
    render()
    await flushQueue()
    expect(harness.update.mock.calls.map(([options]) => options.widgetName))
      .toEqual(['OtterWidgetSmall', 'OtterWidget', 'OtterWidgetLarge'])
    harness.language = 'id'
    render()
    await flushQueue()
    expect(harness.update).toHaveBeenCalledTimes(6)
    expect(lastPayload()?.language).toBe('id')
  })

  it('orders logout clearing behind in-flight provider redraws for every preset', async () => {
    let release!: () => void
    harness.update.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve }))
    harness.workspace.transactions = [expense()]
    render()
    await flushQueue()
    harness.auth.session = null
    render()
    await flushQueue()
    expect(harness.write).toHaveBeenCalledTimes(1)
    expect(harness.update).toHaveBeenCalledTimes(1)
    release()
    await flushQueue()
    expect(lastPayload()).toEqual(buildEmptyWidgetPayload('en'))
    expect(harness.update).toHaveBeenCalledTimes(6)
  })

  it('keeps the latest valid update during immediate effect cleanup/replay', async () => {
    render()
    harness.effect?.cleanup?.()
    if (harness.effect) harness.effect.cleanup = harness.effect.callback()
    await flushQueue()
    expect(lastPayload()).toMatchObject({ walletName: 'Family', language: 'en' })
    expect(harness.update).toHaveBeenCalledTimes(3)
  })
})
