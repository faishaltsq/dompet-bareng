'use no memo'
import React from 'react'
import type { WidgetPayload } from '../lib/widgetPayload'
import { LargeOtterWidget } from './LargeOtterWidget'
import { MediumOtterWidget } from './MediumOtterWidget'
import { SmallOtterWidget } from './SmallOtterWidget'
import { getWidgetLayout } from './widgetDesign'

interface OtterWidgetProps {
  payload: WidgetPayload
  widthDp: number
  heightDp: number
}

export function OtterWidget({ payload, widthDp, heightDp }: OtterWidgetProps) {
  const layout = getWidgetLayout(widthDp, heightDp)
  if (layout.kind === 'large') return <LargeOtterWidget payload={payload} layout={layout} />
  if (layout.kind === 'small') return <SmallOtterWidget payload={payload} layout={layout} />
  return <MediumOtterWidget payload={payload} layout={layout} />
}
