import { useEffect, useRef } from 'react'
import { AppState, Platform } from 'react-native'
import { requestWidgetUpdate } from 'react-native-android-widget'
import { useAuth } from '@/context/AuthContext'
import { useWorkspace } from '@/context/WorkspaceContext'
import { useLanguage } from '@/context/LanguageContext'
import { buildEmptyWidgetPayload, buildWidgetPayload, type WidgetPayload } from '@/lib/widgetPayload'
import { WIDGET_NAMES } from '@/lib/widgetVariants'
import { writeWidgetPayload } from '@/lib/widgetStore'
import { OtterWidget } from '@/widgets/OtterWidget'

function renderOtterWidget(payload: WidgetPayload) {
  return (info: { width: number; height: number }) => {
    return <OtterWidget payload={payload} widthDp={info.width} heightDp={info.height} />
  }
}

export function useWidgetSync(): void {
  const { user, session, loading } = useAuth()
  const { activeWorkspace, transactions } = useWorkspace()
  const { language } = useLanguage()
  const lastFingerprintRef = useRef<string | null>(null)
  const updateQueueRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (Platform.OS !== 'android') return

    const syncWidget = () => {
      const now = new Date()
      const isAuthenticated = !loading && user !== null && session !== null
      const widgetWorkspace = isAuthenticated ? activeWorkspace : null
      const userId = isAuthenticated ? user?.id ?? null : null
      const workspaceId = widgetWorkspace?.id ?? null
      const payload = widgetWorkspace
        ? buildWidgetPayload({
            transactions,
            workspaceId,
            walletName: widgetWorkspace.name,
            language,
            now,
          })
        : buildEmptyWidgetPayload(language)
      const fingerprint = JSON.stringify({
        userId,
        workspaceId,
        localDay: now.toDateString(),
        ...payload,
        updatedAt: '',
      })
      if (lastFingerprintRef.current === fingerprint) return
      lastFingerprintRef.current = fingerprint

      // Keep writes ordered, including across effect cleanup/replay and account changes.
      updateQueueRef.current = updateQueueRef.current
        .catch(() => {})
        .then(async () => {
          await writeWidgetPayload(payload)
          for (const widgetName of WIDGET_NAMES) {
            try {
              await requestWidgetUpdate({
                widgetName,
                renderWidget: renderOtterWidget(payload),
              })
            } catch {
              // Isolate provider failures; persisted data remains ready even in Expo Go.
            }
          }
        })
        .catch(() => {})
    }

    syncWidget()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncWidget()
    })

    let midnightTimer: ReturnType<typeof setTimeout>
    const scheduleMidnight = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      midnightTimer = setTimeout(() => {
        syncWidget()
        scheduleMidnight()
      }, midnight.getTime() - now.getTime())
    }
    scheduleMidnight()

    return () => {
      subscription.remove()
      clearTimeout(midnightTimer)
    }
  }, [activeWorkspace, transactions, language, loading, session, user])
}
