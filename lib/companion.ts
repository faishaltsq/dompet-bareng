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

export type QuickChipId = typeof QUICK_CHIPS[number]['id'];

// ─── Fallback Template Responses ──────────────────────────────────────────────
// Dipakai saat AI API tidak tersedia. Satu template per mood × chip.

function fmtRp(n: number) {
  const abs = Math.abs(n);
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}Rp ${s}`;
}

export function getFallbackChipResponse(
  chipId: QuickChipId,
  snap: FinancialSnapshot,
  mood: MascotMood,
): string {
  const ratio = snap.income > 0 ? snap.expense / snap.income : snap.expense > 0 ? 2 : 0;
  const pctStr = `${Math.round(ratio * 100)}%`;
  const today = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - today;
  const dailyBudget = snap.income > 0 ? Math.floor((snap.income - snap.expense) / Math.max(daysLeft, 1)) : 0;
  const surplus = snap.income - snap.expense;
  const topCat = Object.entries(snap.byCategory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const templates: Record<QuickChipId, Record<MascotMood, string>> = {
    jajan: {
      HAPPY: dailyBudget > 0
        ? `Boleh banget! Sisa harian kamu sekitar ${fmtRp(dailyBudget)}/hari sampai akhir bulan. Pengeluaran baru ${pctStr} dari pemasukan, dompet masih sehat. Tapi tetap wajar ya! 🍔`
        : `Kamu belum punya pemasukan tercatat bulan ini. Masukkan dulu data gaji/pemasukan biar aku bisa hitung budget jajan kamu!`,
      NEUTRAL: dailyBudget > 0
        ? `Boleh jajan, tapi jangan terlalu banyak. Sisa harian sekitar ${fmtRp(dailyBudget)}/hari. Sudah pakai ${pctStr} dari pemasukan — masih oke, tapi hati-hati.`
        : `Catat dulu pemasukan kamu biar aku bisa hitung sisa harian ya!`,
      WARNING: `Hm, sebaiknya tahan dulu. Pengeluaran sudah ${pctStr} dari pemasukan dan bulan belum selesai. Kalau jajan, pilih yang murah meriah saja ya — jangan yang bisa bikin jebol! 😅`,
      PANIC: `Jajan? Jangan dulu! 🚨 Pengeluaran sudah melampaui pemasukan atau saldo tipis. Prioritas sekarang: rem pengeluaran dan cari tambahan pemasukan!`,
    },
    bocor: {
      HAPPY: topCat
        ? `Secara umum dompet sehat. Tapi aku lihat ${topCat} jadi kategori terbesar (${fmtRp(snap.byCategory[topCat] ?? 0)}). Pastikan pengeluaran di sana memang terencana ya, bukan impulsif!`
        : `Pengeluaran bulan ini terlihat terdistribusi dengan baik. Tidak ada kategori yang terlihat bocor. Pertahankan!`,
      NEUTRAL: topCat
        ? `Kategori ${topCat} menyedot paling banyak (${fmtRp(snap.byCategory[topCat] ?? 0)}). Coba cek, apakah ada langganan atau pembelian kecil yang berulang di sana? Hal-hal kecil kalau dijumlah bisa besar.`
        : `Tidak ada kategori yang mencolok. Meskipun begitu, perhatikan pengeluaran harian kecil — kopi, parkir, dll. — karena bisa bocor halus.`,
      WARNING: topCat
        ? `Waspada! ${topCat} sudah menyedot ${fmtRp(snap.byCategory[topCat] ?? 0)} — kemungkinan di sini ada kebocoran halus. Coba tinjau ulang transaksi di kategori ini minggu lalu.`
        : `Pengeluaran total sudah ${pctStr} dari pemasukan. Coba audit transaksi kecil berulang — langganan streaming, jajan mingguan, dll.`,
      PANIC: `Darurat! 🚨 Total pengeluaran ${fmtRp(snap.expense)} vs pemasukan ${fmtRp(snap.income)}. ${topCat ? `Kategori ${topCat} jadi yang terbesar.` : ''} Segera stop pengeluaran tidak penting dan review semua transaksi bulan ini!`,
    },
    roast: {
      HAPPY: surplus > 0
        ? `Dompet kamu... *cukup membosankan*. Pengeluaran cuma ${pctStr} dari pemasukan dan surplus ${fmtRp(surplus)}. Serius? Kamu ini irit banget atau memang gak ada yang mau dibeliin? 😄 Pertahankan — ini langka!`
        : `Dompet kamu... tidak ada yang perlu di-roast. Saldo oke, pengeluaran terkendali. Aku menyerah mencari bahan roast-nya.`,
      NEUTRAL: topCat
        ? `Oke, ${pctStr} pemasukan udah habis dan bulan belum kelar. Kategori ${topCat} jadi biang kerok. Serius, kamu pikir ${topCat} itu investasi? Itu pengeluaran! Yuk kurangin sedikit.`
        : `${pctStr} pemasukan udah melayang dan bulan masih jalan. Dompet kamu mulai kayak es krim di siang hari — mencair pelan-pelan. Awas ya!`,
      WARNING: topCat
        ? `*Tarik napas dalam*... ${pctStr} udah habis dan masih ada ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} hari lagi. ${topCat} menyedot paling banyak — kamu sadar kan itu? Kalau tidak direm, bulan depan bakal panas! 🔥`
        : `Kamu pakai ${pctStr} dari pemasukan dan masih ada beberapa hari tersisa. Dompet kamu kayak baterai HP — merah terus tapi gak dicharge. Ayo kontrol!`,
      PANIC: snap.balance < 0
        ? `Saldo MINUS ${fmtRp(Math.abs(snap.balance))}?! Bukan roast lagi ini, ini SOS! 🚨 Stop semua pengeluaran tidak darurat. Sekarang. Hari ini.`
        : `Pengeluaran udah melampaui pemasukan ${fmtRp(snap.expense)} vs ${fmtRp(snap.income)}. Ini bukan roast, ini alarm kebakaran dompet! Segera evaluasi dan potong pengeluaran!`,
    },
    rangkum: {
      HAPPY: `📊 Ringkasan bulan ini:\n• Pemasukan: ${fmtRp(snap.income)}\n• Pengeluaran: ${fmtRp(snap.expense)} (${pctStr})\n• Sisa: ${fmtRp(surplus)}\n• Total transaksi: ${snap.count}\n${topCat ? `• Terbesar: ${topCat} (${fmtRp(snap.byCategory[topCat] ?? 0)})` : ''}\n\nKondisi: SEHAT! Pertahankan gaya hidup hemat ini. 💚`,
      NEUTRAL: `📊 Ringkasan bulan ini:\n• Pemasukan: ${fmtRp(snap.income)}\n• Pengeluaran: ${fmtRp(snap.expense)} (${pctStr})\n• Sisa: ${fmtRp(surplus > 0 ? surplus : 0)}\n• Total transaksi: ${snap.count}\n${topCat ? `• Terbesar: ${topCat} (${fmtRp(snap.byCategory[topCat] ?? 0)})` : ''}\n\nKondisi: STABIL. Masih oke tapi mulai diperhatikan ya.`,
      WARNING: `📊 Ringkasan bulan ini:\n• Pemasukan: ${fmtRp(snap.income)}\n• Pengeluaran: ${fmtRp(snap.expense)} (${pctStr}) ⚠️\n• Sisa: ${fmtRp(Math.max(surplus, 0))}\n• Total transaksi: ${snap.count}\n${topCat ? `• Terbesar: ${topCat} (${fmtRp(snap.byCategory[topCat] ?? 0)})` : ''}\n\nKondisi: WASPADA. Pengeluaran tinggi, rem sebelum akhir bulan!`,
      PANIC: `📊 Ringkasan bulan ini:\n• Pemasukan: ${fmtRp(snap.income)}\n• Pengeluaran: ${fmtRp(snap.expense)} 🚨\n• Saldo: ${fmtRp(snap.balance)}\n• Total transaksi: ${snap.count}\n${topCat ? `• Terbesar: ${topCat} (${fmtRp(snap.byCategory[topCat] ?? 0)})` : ''}\n\nKondisi: KRITIS! Segera hentikan pengeluaran tidak perlu!`,
    },
  };

  return templates[chipId][mood];
}

/** Fallback untuk input teks bebas berdasarkan kata kunci */
export function getFallbackFreeResponse(
  text: string,
  snap: FinancialSnapshot,
  mood: MascotMood,
): string {
  const lower = text.toLowerCase();
  const surplus = snap.income - snap.expense;
  const ratio = snap.income > 0 ? snap.expense / snap.income : snap.expense > 0 ? 2 : 0;
  const pctStr = `${Math.round(ratio * 100)}%`;

  // Deteksi kata kunci umum
  if (/\b(jajan|makan|beli|bisa beli|boleh)\b/.test(lower)) {
    const today = new Date().getDate();
    const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - today;
    const daily = snap.income > 0 ? Math.floor((snap.income - snap.expense) / Math.max(daysLeft, 1)) : 0;
    if (mood === 'HAPPY' || mood === 'NEUTRAL') {
      return daily > 0
        ? `Sisa budget harian kamu sekitar Rp ${daily.toLocaleString('id-ID')}/hari. Dengan kondisi ${mood === 'HAPPY' ? 'sehat' : 'stabil'} ini, boleh aja — asal sesuai budget ya!`
        : `Belum ada data pemasukan tercatat. Masukkan gaji/pemasukan dulu supaya aku bisa hitung budget harianmu.`;
    }
    return `Kondisi keuangan sedang ${mood === 'WARNING' ? 'waspada' : 'kritis'}. Tahan dulu pengeluaran baru ya. Pengeluaran sudah ${pctStr} dari pemasukan!`;
  }

  if (/\b(saldo|sisa|balance|duit|uang)\b/.test(lower)) {
    return `Saldo saat ini: ${surplus >= 0 ? 'Rp ' + surplus.toLocaleString('id-ID') : '−Rp ' + Math.abs(surplus).toLocaleString('id-ID')}.\nPemasukan ${snap.income > 0 ? 'Rp ' + snap.income.toLocaleString('id-ID') : 'belum tercatat'}, pengeluaran Rp ${snap.expense.toLocaleString('id-ID')} (${pctStr}).`;
  }

  if (/\b(tips|saran|cara|gimana|bagaimana)\b/.test(lower)) {
    const tips: Record<MascotMood, string> = {
      HAPPY: '💡 Karena dompet sedang sehat, ini waktu tepat untuk mulai tabungan darurat — idealnya 3–6× pengeluaran bulanan. Sisihkan otomatis di awal bulan!',
      NEUTRAL: '💡 Coba metode 50/30/20: 50% kebutuhan, 30% keinginan, 20% tabungan. Pengeluaranmu sudah di angka wajar, tinggal konsistensi!',
      WARNING: '💡 Prioritaskan: (1) Lunasi cicilan/tagihan penting, (2) Kurangi pengeluaran tersier dulu, (3) Cari penghasilan tambahan jika bisa.',
      PANIC: '🚨 Langkah darurat: (1) Stop semua pengeluaran non-esensial hari ini, (2) Jual barang yang tidak terpakai, (3) Cari bantuan atau pinjaman darurat jika saldo minus.',
    };
    return tips[mood];
  }

  // Generic fallback berdasarkan mood
  const generic: Record<MascotMood, string> = {
    HAPPY: `Dompet sedang sehat! Pemasukan ${snap.income > 0 ? 'Rp ' + snap.income.toLocaleString('id-ID') : '(belum tercatat)'}, pengeluaran ${pctStr}. Kalau ada pertanyaan spesifik, coba chip "Boleh jajan?" atau "Roast dompet gue" ya — AI asisten sedang offline, tapi aku bisa bantu dengan data yang ada.`,
    NEUTRAL: `Kondisi stabil. Pengeluaran sudah ${pctStr} dari pemasukan. Gunakan chip tanya cepat di atas untuk saran spesifik — AI sedang offline, tapi template analisis tetap aktif.`,
    WARNING: `Waspada — pengeluaran sudah ${pctStr}! Gunakan chip di atas untuk analisis cepat. AI sedang offline, tapi aku tetap bisa kasih gambaran umum dari data transaksimu.`,
    PANIC: `🚨 Kondisi kritis! Pengeluaran melampaui pemasukan. Segera review transaksi dan rem pengeluaran. AI offline, tapi peringatan ini berdasarkan data nyata kamu.`,
  };
  return generic[mood];
}
