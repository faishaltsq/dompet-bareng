import { describe, expect, it } from 'vitest'
import { MASCOT_MOODS, isMascotMood } from '../mascotMoods'
import type { MascotMood } from '../companion'

/**
 * lib/mascotMoods.ts sengaja terpisah dari lib/companion.ts supaya modul widget
 * tidak menarik aset gambar ke dalam bundel headless. Konsekuensinya, kedua
 * daftar bisa saling melenceng — test ini yang menjaganya.
 *
 * Penjaga tingkat tipe memakai Exclude dua arah: mood yang ada di union tapi
 * hilang dari MASCOT_MOODS, maupun mood yang ada di MASCOT_MOODS tapi tak dikenal
 * union. Keduanya membuat file test ini GAGAL BUILD, bukan diam-diam membuat
 * widget menolak payload mood baru.
 */
type MissingFromList = Exclude<MascotMood, (typeof MASCOT_MOODS)[number]>
type ExtraInList = Exclude<(typeof MASCOT_MOODS)[number], MascotMood>

const noMoodMissing: MissingFromList extends never ? true : never = true
const noMoodExtra: ExtraInList extends never ? true : never = true

describe('mascotMoods', () => {
  it('lists exactly the moods the companion can produce', () => {
    // Penjaga tipe di atas sudah menggagalkan build saat daftar melenceng;
    // assertion ini menutupi kasus di mana union ikut diperlebar bersamaan.
    expect(noMoodMissing).toBe(true)
    expect(noMoodExtra).toBe(true)
    expect([...MASCOT_MOODS].sort()).toEqual([
      'HAPPY', 'NEUTRAL', 'PANIC', 'REMINDER', 'RICH', 'THINKING', 'WARNING', 'WELCOME',
    ])
  })

  it('accepts every listed mood and rejects anything else', () => {
    for (const mood of MASCOT_MOODS) {
      expect(isMascotMood(mood)).toBe(true)
    }
    for (const value of ['UNKNOWN', 'happy', '', null, undefined, 42, {}]) {
      expect(isMascotMood(value)).toBe(false)
    }
  })
})
