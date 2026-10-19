import { describe, expect, it } from 'vitest'
import { MASCOT_IMAGES, type MascotMood } from '../companion'

const moods: MascotMood[] = ['HAPPY', 'NEUTRAL', 'WARNING', 'PANIC']

describe('MASCOT_IMAGES', () => {
  it.each(moods)('provides a positive finite numeric asset handle for %s', (mood) => {
    const handle = MASCOT_IMAGES[mood]

    expect(typeof handle).toBe('number')
    expect(Number.isFinite(handle)).toBe(true)
    expect(handle).toBeGreaterThan(0)
  })
})
