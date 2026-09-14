/**
 * lib/companion.ts
 * State machine kesehatan finansial untuk mascot DompetBareng Companion.
 */

export type MascotMood = 'HAPPY' | 'NEUTRAL' | 'WARNING' | 'PANIC';

export interface CompanionState {
  mood: MascotMood;
  emoji: string;
  moodLabel: string;
  color: string;
  softColor: string;
  greeting: string;
  statusLabel: string;
  safeDays: number;
}

export interface FinancialSnapshot {
  income: number;
  expense: number;
  balance: number;
  count: number;
  byCategory: Record<string, number>;
}

/** Hitung berapa hari sisa aman berdasarkan rata-rata pengeluaran harian */
function calcSafeDays(expense: number, balance: number): number {
  if (balance <= 0) return 0;
  const today = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const daysGone = Math.max(today, 1);
  const dailyAvg = expense / daysGone;
  if (dailyAvg <= 0) return 999;
  return Math.floor(balance / dailyAvg);
}

/** Kategori paling boros */
function topCategory(byCategory: Record<string, number>): string | null {
  const entries = Object.entries(byCategory).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/** Hitung rasio pengeluaran terhadap pemasukan (0-1+) */
function expenseRatio(income: number, expense: number): number {
  if (income <= 0) return expense > 0 ? 2 : 0;
  return expense / income;
}

export function evaluateCompanion(snap: FinancialSnapshot): CompanionState {
  const ratio = expenseRatio(snap.income, snap.expense);
  const safeDays = calcSafeDays(snap.expense, snap.balance);
  const topCat = topCategory(snap.byCategory);
  const surplus = snap.income - snap.expense;

  let mood: MascotMood;
  if (ratio > 1 || snap.balance < 0) {
    mood = 'PANIC';
  } else if (ratio >= 0.75) {
    mood = 'WARNING';
  } else if (ratio >= 0.5) {
    mood = 'NEUTRAL';
  } else {
    mood = 'HAPPY';
  }

  const configs: Record<MascotMood, Omit<CompanionState, 'safeDays' | 'greeting' | 'statusLabel'>> = {
    HAPPY: {
      mood: 'HAPPY',
      emoji: '😄',
      moodLabel: 'Sehat & Hemat',
      color: '#1CAB68',
      softColor: '#E8F9F1',
    },
    NEUTRAL: {
      mood: 'NEUTRAL',
      emoji: '😊',
      moodLabel: 'Stabil',
      color: '#3B82F6',
      softColor: '#EFF6FF',
    },
    WARNING: {
      mood: 'WARNING',
      emoji: '😅',
      moodLabel: 'Waspada',
      color: '#F59E0B',
      softColor: '#FFF8E7',
    },
    PANIC: {
      mood: 'PANIC',
      emoji: '😱',
      moodLabel: 'Kritis!',
      color: '#FF4757',
      softColor: '#FFF0F1',
    },
  };

  const greetings: Record<MascotMood, string[]> = {
    HAPPY: [
      `Mantap! Bulan ini pengeluaran masih ${Math.round(ratio * 100)}% dari pemasukan. Dompet makin sehat! 💪`,
      `Surplus ${formatRupiah(surplus)} bulan ini. Pertahankan gaya hidup hemat ini ya!`,
      topCat
        ? `Pengeluaran terbesar di kategori ${topCat}, tapi masih dalam batas aman. Bagus!`
        : `Keuangan bulan ini solid! Semangat terus.`,
    ],
    NEUTRAL: [
      `Sudah pakai ${Math.round(ratio * 100)}% dari pemasukan bulan ini. Masih oke, tapi jangan kebablasan ya.`,
      topCat
        ? `${topCat} jadi kategori paling banyak keluar. Coba dicek lagi perlu semua gak?`
        : `Pengeluaran mulai mendekati setengah pemasukan. Pantau terus ya!`,
    ],
    WARNING: [
      `Hati-hati! Sudah habis ${Math.round(ratio * 100)}% dari pemasukan dan bulan belum selesai.`,
      topCat
        ? `${topCat} menyedot paling banyak. Mungkin saatnya kurangi sedikit di sana?`
        : `Pengeluaran mulai tinggi. Evaluasi dulu sebelum jajan lagi!`,
    ],
    PANIC: [
      snap.balance < 0
        ? `Aduh, saldo minus ${formatRupiah(Math.abs(snap.balance))}! Rem dulu pengeluarannya. 🚨`
        : `Pengeluaran sudah melebihi pemasukan bulan ini! Gawat — harus segera dikontrol.`,
      `Coba ketik "roast dompet gue" biar aku bantu analisis lebih detail.`,
    ],
  };

  const statusLabels: Record<MascotMood, string> = {
    HAPPY: safeDays >= 999 ? 'Dompet super aman 🎉' : `Aman untuk ${safeDays} hari ke depan`,
    NEUTRAL: `Aman untuk ~${safeDays} hari ke depan`,
    WARNING: `Sisa aman ~${safeDays} hari — hati-hati!`,
    PANIC: safeDays <= 0 ? 'Saldo habis / minus ⚠️' : `Hanya tersisa ${safeDays} hari!`,
  };

  const cfg = configs[mood];
  const greetingList = greetings[mood];
  const greeting = greetingList[Math.floor(Math.random() * greetingList.length)];

  return {
    ...cfg,
    greeting,
    statusLabel: statusLabels[mood],
    safeDays,
  };
}

function formatRupiah(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${amount < 0 ? '-' : ''}Rp ${formatted}`;
}

/** Mascot image assets per mood */
import { ImageSourcePropType } from 'react-native';

export const MASCOT_IMAGES: Record<MascotMood, ImageSourcePropType> = {
  HAPPY:   require('../mascot/otter-happy.png'),
  NEUTRAL: require('../mascot/otter-idle.png'),
  WARNING: require('../mascot/otter-warning.png'),
  PANIC:   require('../mascot/otter-panic.png'),
};

/** Quick action chips */
export const QUICK_CHIPS = [
  { id: 'jajan', label: '🍔 Boleh jajan gak?', prompt: 'Boleh jajan gak hari ini? Cek sisa aman harian aku dong.' },
  { id: 'bocor', label: '🔍 Cek kebocoran halus', prompt: 'Analisis pengeluaran kecil yang berulang-ulang di dompet ini. Ada yang bocor halus gak?' },
  { id: 'roast', label: '🔥 Roast dompet gue', prompt: 'Roast dompet aku dengan gaya sarkas tapi mendidik. Jujur ya!' },
  { id: 'rangkum', label: '📊 Rangkum minggu ini', prompt: 'Buat ringkasan kondisi keuangan minggu ini berdasarkan data transaksi yang ada.' },
] as const;
