import { expect, it, vi } from 'vitest'

const { events } = vi.hoisted(() => ({ events: [] as string[] }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }))
vi.mock('react-native-android-widget', () => ({
  registerWidgetTaskHandler: () => { events.push('widget') },
}))
vi.mock('../../widget-task-handler', () => ({ widgetTaskHandler: async () => {} }))
vi.mock('expo-router/entry', () => {
  events.push('router')
  return {}
})

it('registers the headless widget before evaluating the Expo Router entry', async () => {
  await import('../../index')
  expect(events).toEqual(['widget', 'router'])
})
