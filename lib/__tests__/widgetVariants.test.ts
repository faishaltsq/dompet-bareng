import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import appConfig from '../../app.json'
import { WIDGET_NAMES, WIDGET_VARIANTS } from '../widgetVariants'

// Exercise real Settings callbacks/JSX and translations without a native renderer.
// Native navigation, animation, and unrelated providers stay at the boundary.
const ui = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0,
  languageValue: undefined as unknown,
  platform: { OS: 'android' },
  pin: vi.fn<({ widgetName }: { widgetName: string }) => Promise<boolean>>(),
  alert: vi.fn(),
}))
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = ui.cursor++
    if (!(index in ui.states)) ui.states[index] = initial
    return [ui.states[index], (value: unknown) => { ui.states[index] = value }]
  },
  useEffect: () => {},
  useCallback: (callback: unknown) => callback,
  useRef: (value: unknown) => ({ current: value }),
  useContext: () => ui.languageValue,
}))
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator', Image: 'Image', TextInput: 'TextInput', Modal: 'Modal', Switch: 'Switch',
  StyleSheet: { create: (styles: unknown) => styles }, Platform: ui.platform, Alert: { alert: ui.alert },
  useWindowDimensions: () => ({ width: 375, height: 812, scale: 1, fontScale: 1 }),
}))
vi.mock('react-native-android-widget', () => ({ requestPinWidget: ui.pin }))
vi.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation }
  return { default: { View: 'AnimatedView' }, FadeInDown: animation, SlideInDown: animation }
})
vi.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }))
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }))
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }), useFocusEffect: () => {}, useIsFocused: () => true }))
vi.mock('expo-image-picker', () => ({}))
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }))
vi.mock('@/components/SwipeableModal', () => ({ default: 'SwipeableModal' }))
vi.mock('@/components/InviteShareModal', () => ({ default: 'InviteShareModal' }))
vi.mock('@/components/WorkspaceQrPanel', () => ({ WorkspaceQrPanel: 'WorkspaceQrPanel' }))
vi.mock('@/components/WorkspaceJoinRequestsPanel', () => ({ WorkspaceJoinRequestsPanel: 'WorkspaceJoinRequestsPanel' }))
vi.mock('@/hooks/useJoinRequests', () => ({ useJoinRequests: () => ({ pendingCount: 0 }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, profile: null }) }))
vi.mock('@/context/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: null, workspaces: [] }) }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/notifications', () => ({ scheduleDailyReminder: vi.fn(), cancelAllReminders: vi.fn(), isReminderEnabled: vi.fn() }))
vi.mock('@/lib/updates', () => ({ getCurrentUpdateInfo: () => ({}), checkAndApplyUpdate: vi.fn() }))
vi.mock('@/lib/downloadApp', () => ({ triggerDownloadApk: vi.fn() }))

import SettingsScreen from '../../app/(tabs)/two'
import { LanguageProvider } from '../../context/LanguageContext'

type Node = ReactElement<Record<string, any>>
function elements(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, any>>(node)) return []
  return [node, ...elements(node.props.children)]
}
function renderSettings() {
  ui.cursor = 0
  return elements(SettingsScreen())
}
function language(value: 'id' | 'en') {
  ui.states = [value]
  ui.cursor = 0
  const provider = LanguageProvider({ children: null })
  ui.languageValue = provider.props.value
  ui.states = []
  ui.cursor = 0
}
function translate(key: string) {
  return (ui.languageValue as { t: (key: any) => string }).t(key)
}
function widgetEntry(tree = renderSettings()) {
  return tree.find((node) => node.props.accessibilityLabel === translate('widgetTitle'))!
}
function sizeChooser(tree = renderSettings()) {
  return tree.find((node) => node.type === 'SwipeableModal'
    && elements(node.props.children).some((child) => child.props.children === translate('widgetSizeChooserTitle')))!
}
function sizeRows() {
  return elements(sizeChooser().props.children).filter((node) => node.props.testID?.startsWith('widget-size-'))
}

beforeEach(() => {
  vi.clearAllMocks()
  ui.platform.OS = 'android'
  ui.pin.mockResolvedValue(true)
  language('id')
})

function nativeWidgets() {
  const plugin = appConfig.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'react-native-android-widget')
  return (plugin as [string, { widgets: Array<Record<string, unknown>> }])[1].widgets
}

describe('native widget presets', () => {
  it('opens a size chooser before requesting a pin', async () => {
    await widgetEntry().props.onPress()
    expect(ui.pin).not.toHaveBeenCalled()
    const chooser = renderSettings().find((node) => node.type === 'SwipeableModal' && node.props.visible
      && elements(node.props.children).some((child) => child.props.children === translate('widgetSizeChooserTitle')))
    expect(chooser).toBeDefined()
    const rows = elements(chooser!.props.children).filter((node) => node.props.testID?.startsWith('widget-size-'))
    expect(rows).toHaveLength(3)
    expect(rows.map((node) => node.props.accessibilityLabel)).toEqual(['Kecil, 2×2', 'Sedang, 4×2', 'Besar, 4×4'])
  })

  it('shares ordered provider identities and size metadata with native config', () => {
    expect(WIDGET_VARIANTS).toEqual([
      { name: 'OtterWidgetSmall', kind: 'small', columns: 2, rows: 2, labelKey: 'widgetSizeSmall', descriptionKey: 'widgetSizeSmallDesc' },
      { name: 'OtterWidget', kind: 'medium', columns: 4, rows: 2, labelKey: 'widgetSizeMedium', descriptionKey: 'widgetSizeMediumDesc' },
      { name: 'OtterWidgetLarge', kind: 'large', columns: 4, rows: 4, labelKey: 'widgetSizeLarge', descriptionKey: 'widgetSizeLargeDesc' },
    ])
    expect(WIDGET_NAMES).toEqual(nativeWidgets().map((widget) => widget.name))
    expect(WIDGET_VARIANTS.map(({ columns, rows }) => [columns, rows]))
      .toEqual(nativeWidgets().map((widget) => [widget.targetCellWidth, widget.targetCellHeight]))
  })

  it.each([
    ['id', ['Kecil', 'Sedang', 'Besar'], 'Pilih Ukuran Widget', 'Batal'],
    ['en', ['Small', 'Medium', 'Large'], 'Choose Widget Size', 'Cancel'],
  ] as const)('shows translated chooser labels, details, size badges and accessible rows (%s)', (locale, labels, title, cancel) => {
    language(locale)
    widgetEntry().props.onPress()
    expect(sizeChooser().props.visible).toBe(true)
    const text = elements(sizeChooser().props.children).map((node) => node.props.children)
    expect(text).toContain(title)
    expect(text).toContain(cancel)
    expect(text).toContain(translate('widgetSizeChooserDetails'))
    expect(translate('widgetSizeChooserDetails')).not.toBe('widgetSizeChooserDetails')
    sizeRows().forEach((row, index) => {
      const variant = WIDGET_VARIANTS[index]
      expect(row.props.accessibilityRole).toBe('button')
      expect(row.props.accessibilityLabel).toBe(`${labels[index]}, ${variant.columns}×${variant.rows}`)
      expect(row.props.accessibilityHint).toBe(translate(variant.descriptionKey))
      expect(row.props.accessibilityHint).not.toBe(variant.descriptionKey)
      const rowText = elements(row.props.children).map((node) => node.props.children)
      expect(rowText).toContain(labels[index])
      expect(rowText).toContain(translate(variant.descriptionKey))
      expect(rowText.some((value) => Array.isArray(value) && value.join('') === `${variant.columns}×${variant.rows}`)).toBe(true)
    })
  })

  it.each(WIDGET_VARIANTS)('closes the chooser and requests only $name', async (variant) => {
    widgetEntry().props.onPress()
    ui.pin.mockImplementationOnce(async () => {
      expect(sizeChooser().props.visible).toBe(false)
      return true
    })
    const row = sizeRows().find((node) => node.props.testID === `widget-size-${variant.kind}`)!
    await row.props.onPress()
    expect(ui.pin).toHaveBeenCalledExactlyOnceWith({ widgetName: variant.name })
    expect(sizeChooser().props.visible).toBe(false)
    expect(ui.alert).not.toHaveBeenCalled()
  })

  it.each(['close', 'cancel'])('dismisses the chooser without pinning via %s', (method) => {
    widgetEntry().props.onPress()
    if (method === 'close') sizeChooser().props.onClose()
    else elements(sizeChooser().props.children).find((node) => node.props.accessibilityLabel === translate('widgetSizeChooserCancel'))!.props.onPress()
    expect(sizeChooser().props.visible).toBe(false)
    expect(ui.pin).not.toHaveBeenCalled()
  })

  it.each(['false', 'rejection'])('retains the localized unsupported-launcher fallback on %s', async (result) => {
    if (result === 'false') ui.pin.mockResolvedValueOnce(false)
    else ui.pin.mockRejectedValueOnce(new Error('Not available'))
    widgetEntry().props.onPress()
    await sizeRows()[0].props.onPress()
    expect(ui.alert).toHaveBeenCalledExactlyOnceWith(translate('widgetPinUnsupportedTitle'), translate('widgetPinUnsupportedDesc'))
    expect(sizeChooser().props.visible).toBe(false)
  })

  it.each(['ios', 'web'])('hides the entry and chooser outside Android (%s)', (os) => {
    ui.platform.OS = os
    expect(widgetEntry()).toBeUndefined()
    expect(sizeChooser()).toBeUndefined()
    expect(ui.pin).not.toHaveBeenCalled()
  })

  it('registers three resizable presets while preserving the installed medium provider', () => {
    expect(nativeWidgets()).toEqual([
      {
        name: 'OtterWidgetSmall', label: 'Dompet Bareng Kecil (2×2)',
        description: 'Pengeluaran hari ini dalam tampilan ringkas (2×2)',
        minWidth: '110dp', minHeight: '110dp', targetCellWidth: 2, targetCellHeight: 2,
        resizeMode: 'horizontal|vertical', previewImage: './assets/widget-preview/otter-small.png', updatePeriodMillis: 1800000,
      },
      {
        name: 'OtterWidget', label: 'Dompet Bareng Sedang (4×2)',
        description: 'Pengeluaran hari ini dan saran otter (4×2)',
        minWidth: '250dp', minHeight: '110dp', targetCellWidth: 4, targetCellHeight: 2,
        resizeMode: 'horizontal|vertical', previewImage: './assets/widget-preview/otter-widget.png', updatePeriodMillis: 1800000,
      },
      {
        name: 'OtterWidgetLarge', label: 'Dompet Bareng Besar (4×4)',
        description: 'Ringkasan pengeluaran dan detail dompet (4×4)',
        minWidth: '250dp', minHeight: '250dp', targetCellWidth: 4, targetCellHeight: 4,
        resizeMode: 'horizontal|vertical', previewImage: './assets/widget-preview/otter-large.png', updatePeriodMillis: 1800000,
      },
    ])
  })
})
