import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { buildEmptyWidgetPayload } from '../widgetPayload'
import { readWidgetPayload, writeWidgetPayload } from '../widgetStore'
import { refreshWidgetPayloadFromNetwork } from '../widgetRefresh'
import { widgetTaskHandler } from '../../widget-task-handler'
import { WIDGET_NAMES } from '../widgetVariants'

vi.mock('../widgetStore', () => ({ readWidgetPayload: vi.fn(), writeWidgetPayload: vi.fn() }))
vi.mock('../widgetRefresh', () => ({ refreshWidgetPayloadFromNetwork: vi.fn() }))
vi.mock('../../widgets/OtterWidget', () => ({ OtterWidget: () => null }))

function task(widgetAction: WidgetTaskHandlerProps['widgetAction'] = 'WIDGET_UPDATE'): WidgetTaskHandlerProps {
  return {
    widgetAction,
    widgetInfo: {
      widgetName: 'OtterWidget', widgetId: 1, width: 320, height: 160,
      screenInfo: { density: 3, densityDpi: 480, screenWidthDp: 400, screenHeightDp: 800 },
    },
    renderWidget: vi.fn(),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(readWidgetPayload).mockResolvedValue(null)
  vi.mocked(writeWidgetPayload).mockResolvedValue(undefined)
  vi.mocked(refreshWidgetPayloadFromNetwork).mockResolvedValue(null)
})

afterEach(() => { vi.useRealTimers() })

describe('widgetTaskHandler', () => {
  it.each(WIDGET_NAMES)('replaces yesterday’s cached expense with a refresh placeholder for %s', async (widgetName) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T00:05:00'))
    vi.mocked(readWidgetPayload).mockResolvedValue({
      ...buildEmptyWidgetPayload('en', 'Keluarga'),
      todayExpense: 125000,
      todayCount: 3,
      updatedAt: new Date('2026-10-18T23:59:00').toISOString(),
    })
    const props = task()
    props.widgetInfo.widgetName = widgetName
    await widgetTaskHandler(props)
    expect(vi.mocked(props.renderWidget).mock.calls[0][0])
      .toHaveProperty('props.payload', buildEmptyWidgetPayload('en', 'Keluarga'))
    // Cache kemarin dipicu refresh jaringan; kegagalan di sana jatuh ke placeholder.
    expect(refreshWidgetPayloadFromNetwork).toHaveBeenCalledTimes(1)
    expect(writeWidgetPayload).not.toHaveBeenCalled()
  })

  it('refreshes over the network and persists when the cached payload is from yesterday', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T08:00:00'))
    vi.mocked(readWidgetPayload).mockResolvedValue({
      ...buildEmptyWidgetPayload('en', 'Keluarga'),
      todayExpense: 125000,
      todayCount: 3,
      updatedAt: new Date('2026-10-19T23:59:00').toISOString(),
    })
    const fresh = {
      ...buildEmptyWidgetPayload('en', 'Keluarga'),
      todayExpense: 45000,
      todayCount: 2,
      updatedAt: new Date('2026-10-20T08:00:00').toISOString(),
    }
    vi.mocked(refreshWidgetPayloadFromNetwork).mockResolvedValue(fresh)

    const props = task()
    await widgetTaskHandler(props)

    expect(vi.mocked(props.renderWidget).mock.calls[0][0]).toHaveProperty('props.payload', fresh)
    // Hasil segar disimpan, supaya update berikutnya tidak perlu menarik jaringan.
    expect(writeWidgetPayload).toHaveBeenCalledWith(fresh)
  })

  it('retains today’s cached payload when rendering a periodic update', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T15:00:00'))
    const payload = {
      ...buildEmptyWidgetPayload('id', 'Keluarga'),
      todayExpense: 50000,
      todayCount: 1,
      updatedAt: new Date('2026-10-19T09:00:00').toISOString(),
    }
    vi.mocked(readWidgetPayload).mockResolvedValue(payload)
    const props = task()
    await widgetTaskHandler(props)
    expect(vi.mocked(props.renderWidget).mock.calls[0][0]).toHaveProperty('props.payload', payload)
    // Masih hari yang sama: angka cache masih sah, tidak ada tarikan jaringan.
    expect(refreshWidgetPayloadFromNetwork).not.toHaveBeenCalled()
    expect(writeWidgetPayload).not.toHaveBeenCalled()
  })

  it.each(WIDGET_NAMES.flatMap((widgetName) => [
    { widgetName, width: 110.5, height: 110.25 },
    { widgetName, width: 317.5, height: 161.25 },
    { widgetName, width: 510, height: 340 },
  ]))('passes actual launcher DP through on resize: $widgetName $width × $height', async ({ widgetName, width, height }) => {
    const props = task('WIDGET_RESIZED')
    props.widgetInfo = { ...props.widgetInfo, widgetName, width, height }
    await widgetTaskHandler(props)
    const element = vi.mocked(props.renderWidget).mock.calls[0][0]
    expect(element).toHaveProperty('props.widthDp', width)
    expect(element).toHaveProperty('props.heightDp', height)
  })

  it.each(WIDGET_NAMES)('does not read or render a deleted %s', async (widgetName) => {
    const props = task('WIDGET_DELETED')
    props.widgetInfo.widgetName = widgetName
    await widgetTaskHandler(props)
    expect(readWidgetPayload).not.toHaveBeenCalled()
    expect(props.renderWidget).not.toHaveBeenCalled()
  })

  it.each(WIDGET_NAMES)('renders a neutral placeholder for %s if storage has no payload', async (widgetName) => {
    const props = task('WIDGET_ADDED')
    props.widgetInfo.widgetName = widgetName
    await widgetTaskHandler(props)
    const element = vi.mocked(props.renderWidget).mock.calls[0][0]
    expect(element).toHaveProperty('props.payload', buildEmptyWidgetPayload())
  })
})
