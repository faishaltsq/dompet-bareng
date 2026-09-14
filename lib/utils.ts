import { Colors } from '@/constants/theme';

/** Format angka ke Rupiah dengan titik ribuan: 50000 -> "Rp 50.000" */
export function formatRupiah(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${amount < 0 ? '-' : ''}Rp ${formatted}`;
}

/** Format input string saat user mengetik: "10000" -> "10.000" */
export function formatCurrencyInput(val: string): string {
  const clean = val.replace(/[^0-9]/g, '');
  if (!clean) return '';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Parse string berformat ke number: "10.000" -> 10000 */
export function parseCurrencyInput(val: string): number {
  const clean = val.replace(/[^0-9]/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

/** Format tanggal & jam lengkap Indonesia: "12 Sep 2026, 14:30 WIB" */
export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/** Kategori preset */
export const EXPENSE_CATEGORIES = [
  'Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan',
  'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya',
] as const;

export const INCOME_CATEGORIES = [
  'Gaji', 'Transfer', 'Bonus', 'Investasi', 'Lainnya',
] as const;

/** Compact category marker + warna pastel per kategori */
export const CATEGORY_META: Record<string, { emoji: string; bg: string; color: string }> = {
  'Makan & Minum': { emoji: '🍜', bg: Colors.expenseSoft, color: Colors.expense },
  'Transportasi':  { emoji: '🚗', bg: Colors.accentBlueSoft, color: Colors.accentBlue },
  'Belanja':       { emoji: '🛒', bg: Colors.savingsSoft, color: Colors.savings },
  'Tagihan':       { emoji: '📄', bg: '#FFF3E0', color: '#E65100' },
  'Hiburan':       { emoji: '🎮', bg: Colors.accentPurpleSoft, color: Colors.accentPurple },
  'Kesehatan':     { emoji: '💊', bg: Colors.accentTealSoft, color: Colors.accentTeal },
  'Pendidikan':    { emoji: '📚', bg: Colors.accentBlueSoft, color: Colors.accentBlue },
  'Gaji':          { emoji: '💰', bg: Colors.incomeSoft, color: Colors.income },
  'Transfer':      { emoji: '🔄', bg: Colors.accentTealSoft, color: Colors.accentTeal },
  'Bonus':         { emoji: '🎁', bg: Colors.savingsSoft, color: Colors.savings },
  'Investasi':     { emoji: '📈', bg: Colors.primarySoft, color: Colors.primaryDark },
  'Lainnya':       { emoji: '📌', bg: '#F0F1F5', color: Colors.textMuted },
};

export function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? CATEGORY_META['Lainnya'];
}
