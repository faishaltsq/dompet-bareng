import React from 'react'
import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { readWidgetPayload, writeWidgetPayload } from './lib/widgetStore'
import { buildEmptyWidgetPayload, refreshWidgetPayload, type WidgetPayload } from './lib/widgetPayload'
import { refreshWidgetPayloadFromNetwork } from './lib/widgetRefresh'
import { OtterWidget } from './widgets/OtterWidget'

function isSameLocalDay(iso: string, now: Date): boolean {
  const writtenAt = new Date(iso)
  return Number.isFinite(writtenAt.getTime()) && writtenAt.toDateString() === now.toDateString()
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo, widgetAction, renderWidget } = props
  if (widgetAction === 'WIDGET_DELETED') return

  const stored = await readWidgetPayload()
  const now = new Date()
  let payload: WidgetPayload

  if (stored && isSameLocalDay(stored.updatedAt, now)) {
    payload = stored
  } else {
    // Cache kemarin tidak bisa dipercaya untuk total hari ini, tapi widget tetap
    // harus menampilkan angka nyata tanpa menunggu aplikasi dibuka — tarik data
    // segar dari Supabase. Jaringan gagal atau belum login: jatuh ke placeholder.
    payload = (await refreshWidgetPayloadFromNetwork(now))
      ?? refreshWidgetPayload(stored ?? buildEmptyWidgetPayload(), now)
    // Simpan hasil segar supaya update berikutnya tidak perlu menarik jaringan.
    if (payload.updatedAt) await writeWidgetPayload(payload)
  }

  // AppWidgetManager reports widget bounds in dp already.
  const widthDp = widgetInfo.width
  const heightDp = widgetInfo.height

  renderWidget(React.createElement(OtterWidget, { payload, widthDp, heightDp }))
}
