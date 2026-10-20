/**
 * lib/mascotMoods.ts
 *
 * Daftar mood mascot sebagai data runtime, terpisah dari lib/companion.ts.
 *
 * Dipisah karena dua alasan:
 *   1. lib/companion.ts mengimpor aset gambar (MASCOT_IMAGES). Widget menarik
 *      modul ini secara headless, jadi dependensi ke companion akan menarik
 *      gambar PNG ke dalam bundel widget.
 *   2. lib/companion.ts sedang aktif dikembangkan; daftar mood harus punya
 *      tempat sendiri yang tidak ikut berubah-ubah di sana.
 *
 * Konsistensi dengan union MascotMood dijaga di lib/__tests__/mascotMoods.test.ts
 * — assertion tingkat tipe membuat penambahan mood baru gagal build, bukan
 * diam-diam membuat widget menolak payload yang baru.
 */

export const MASCOT_MOODS = [
  'WELCOME',
  'THINKING',
  'PANIC',
  'REMINDER',
  'WARNING',
  'RICH',
  'NEUTRAL',
  'HAPPY',
] as const;

export type MascotMoodName = (typeof MASCOT_MOODS)[number];

const MASCOT_MOOD_SET: ReadonlySet<string> = new Set(MASCOT_MOODS);

export function isMascotMood(value: unknown): value is MascotMoodName {
  return typeof value === 'string' && MASCOT_MOOD_SET.has(value);
}
