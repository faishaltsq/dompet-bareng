import React from 'react'
import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { readWidgetPayload } from './lib/widgetStore'
import { buildEmptyWidgetPayload, refreshWidgetPayload } from './lib/widgetPayload'
import { OtterWidget } from './widgets/OtterWidget'

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo, widgetAction, renderWidget } = props
  if (widgetAction === 'WIDGET_DELETED') return

  const payload = refreshWidgetPayload((await readWidgetPayload()) ?? buildEmptyWidgetPayload())
  // AppWidgetManager reports widget bounds in dp already.
  const widthDp = widgetInfo.width
  const heightDp = widgetInfo.height

  renderWidget(React.createElement(OtterWidget, { payload, widthDp, heightDp }))
}
