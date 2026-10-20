/**
 * lib/storageKeys.ts
 *
 * Kunci AsyncStorage yang dipakai lintas modul. Dipisah dari context agar bisa
 * dibaca headless (widget task handler) tanpa ikut menarik kamus terjemahan
 * dan React context ke dalam bundel widget.
 */

export const LANGUAGE_STORAGE_KEY = '@dompetbareng_app_language';

/**
 * Kunci workspace aktif per pengguna. Ditulis oleh WorkspaceContext saat user
 * memilih dompet; widget memakainya untuk menampilkan dompet yang sama.
 */
export const activeWorkspaceStorageKey = (userId: string) => `@db:active_workspace:${userId}`;
