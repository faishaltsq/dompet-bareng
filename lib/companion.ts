/**
 * lib/companion.ts
 * State machine kesehatan finansial untuk mascot DompetBareng Companion.
 */

/**
 * Daftar mood mascot, diurutkan berdasarkan bandingan keparahan keuangan.
 * WELCOME / THINKING adalah keadaan "data belum bisa dinilai", REMINDER adalah
 * pengingat yang bisa ditindaklanjuti — keduanya dipilih berdasarkan prioritas
 * di dalam evaluateCompanion, bukan berdasarkan urutan di sini.
 */
export type MascotMood =
  | 'WELCOME'
  | 'THINKING'
  | 'PANIC'
  | 'REMINDER'
  | 'WARNING'
  | 'RICH'
  | 'NEUTRAL'
  | 'HAPPY';

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
  otherWithDesc?: string[]; // transaksi Lainnya yang punya deskripsi
  otherNoDesc?: number;     // jumlah transaksi Lainnya tanpa deskripsi
}

/** Hitung berapa hari sisa aman berdasarkan rata-rata pengeluaran harian */
function calcSafeDays(expense: number, balance: number): number {
  if (balance <= 0) return 0;
  const today = new Date().getDate();
  // Tanggal 1-3 awal bulan di-smooth minimal 3 hari agar pengeluaran tagihan awal bulan
  // tidak menyebabkan pembagian ekstrim / false panic
  const daysGone = Math.max(today, 3);
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

/**
 * Surplus minimum dalam rupiah sebelum mood boleh jadi RICH.
 * Rasio rendah saja tidak cukup: angka kecil tidak layak menampilkan kantung uang.
 */
const RICH_MIN_SURPLUS = 500_000;

export function evaluateCompanion(snap: FinancialSnapshot, language: 'id' | 'en' = 'id'): CompanionState {
  const ratio = expenseRatio(snap.income, snap.expense);
  const safeDays = calcSafeDays(snap.expense, snap.balance);
  const topCat = topCategory(snap.byCategory);
  const surplus = snap.income - snap.expense;

  let mood: MascotMood;
  // Urutan cabang INI adalah prioritas — bukan sekadar ranking. Keadaan yang
  // bisa ditindaklanjuti (situation) menang atas bandingan keparahan ketika
  // keduanya menyala, karena keduanya menceritakan hal yang berbeda.
  if (snap.count === 0) {
    // Dompet masih kosong. Bukan sehat, bukan kritis — belum ada apa-apa dinilai.
    mood = 'WELCOME';
  } else if (snap.income <= 0 && snap.expense > 0) {
    // Ada pengeluaran tapi pemasukan belum pernah dicatat. expenseRatio()
    // mengembalikan 2 untuk kasus ini, jadi tanpa guard ini dompet baru langsung
    // menjerit PANIC karena alasan yang salah.
    mood = 'THINKING';
  } else if (ratio > 1 || snap.balance < 0) {
    mood = 'PANIC';
  } else if (safeDays <= 3) {
    // Baris aman tinggal 3 hari. Kalau sudah kritis, PANIC di atas yang menang —
    // pengingat ini hanya muncul di bandingan masih bisa diperbaiki.
    mood = 'REMINDER';
  } else if (ratio >= 0.75) {
    mood = 'WARNING';
  } else if (ratio <= 0.25 && surplus >= Math.max(RICH_MIN_SURPLUS, 0.2 * snap.income)) {
    // Butuh surplus RUPIAH beneran, bukan cuma rasio kecil: pengeluaran Rp 50rb
    // dari pemasukan Rp 200rb ber-razio 0.25 tapi bukan kekayaan.
    mood = 'RICH';
  } else if (ratio >= 0.5) {
    mood = 'NEUTRAL';
  } else {
    mood = 'HAPPY';
  }

  const moodLabels: Record<'id' | 'en', Record<MascotMood, string>> = {
    id: {
      WELCOME: 'Baru Mulai',
      THINKING: 'Belum Bisa Dinilai',
      PANIC: 'Kritis!',
      REMINDER: 'Ingat Ya!',
      WARNING: 'Waspada',
      RICH: 'Surplus Besar',
      NEUTRAL: 'Stabil',
      HAPPY: 'Sehat & Hemat',
    },
    en: {
      WELCOME: 'Getting Started',
      THINKING: 'Not Enough Data',
      PANIC: 'Critical!',
      REMINDER: 'Heads Up',
      WARNING: 'Caution',
      RICH: 'Big Surplus',
      NEUTRAL: 'Stable',
      HAPPY: 'Healthy & Frugal',
    },
  };

  const configs: Record<MascotMood, { emoji: string; color: string; softColor: string }> = {
    WELCOME: { emoji: '👋', color: '#F97316', softColor: '#FFF1E6' },
    THINKING: { emoji: '🤔', color: '#7C83DB', softColor: '#EEEEFC' },
    PANIC: { emoji: '😱', color: '#FF4757', softColor: '#FFF0F1' },
    REMINDER: { emoji: '📣', color: '#0EA5A5', softColor: '#E2F7F6' },
    WARNING: { emoji: '😅', color: '#F59E0B', softColor: '#FFF8E7' },
    RICH: { emoji: '🤑', color: '#E8A400', softColor: '#FFF6DC' },
    NEUTRAL: { emoji: '😊', color: '#3B82F6', softColor: '#EFF6FF' },
    HAPPY: { emoji: '😄', color: '#1CAB68', softColor: '#E8F9F1' },
  };

  const greetings: Record<'id' | 'en', Record<MascotMood, string[]>> = {
    id: {
      WELCOME: [
        `Selamat datang di dompet bareng kamu! 🎉 Catat transaksi pertama dan aku bakal mulai ngitung kondisinya.`,
        `Belum ada transaksi sama sekali. Tambah satu pengeluaran atau pemasukan dan aku langsung punya bahan analisis.`,
      ],
      THINKING: [
        `Sudah ada ${fmtRp(snap.expense)} pengeluaran, tapi belum ada pemasukan tercatat. Masukkan gaji/pemasukan dulu ya, biar aku bisa nilai kondisinya.`,
        `Aku belum bisa menebak dompet kamu dari pengeluaran saja. Catat pemasukannya dan aku kasih gambaran lengkap.`,
      ],
      PANIC: [
        snap.balance < 0
          ? `Aduh, saldo minus ${formatRupiah(Math.abs(snap.balance))}! Rem dulu pengeluarannya. 🚨`
          : `Pengeluaran sudah melebihi pemasukan bulan ini! Gawat — harus segera dikontrol.`,
        `Coba ketik "roast dompet gue" biar aku bantu analisis lebih detail.`,
      ],
      REMINDER: [
        `Barisan aman tinggal ${safeDays} hari dengan rata-rata pengeluaran ${fmtRp(Math.round(snap.expense / Math.max(new Date().getDate(), 3)))}/hari. Pelan-pelan ya.`,
        `Heads up! Kalau kecepatan ini berlanjut, saldo habis sebelum akhir bulan. Coba tahan pengeluaran yang bisa ditunda.`,
      ],
      WARNING: [
        `Hati-hati! Sudah habis ${Math.round(ratio * 100)}% dari pemasukan dan bulan belum selesai.`,
        topCat
          ? `${topCat} menyedot paling banyak. Mungkin saatnya kurangi sedikit di sana?`
          : `Pengeluaran mulai tinggi. Evaluasi dulu sebelum jajan lagi!`,
      ],
      RICH: [
        `Surplus ${formatRupiah(surplus)} bulan ini dan baru pakai ${Math.round(ratio * 100)}% pemasukan. Mantap banget! 💰`,
        `Dompet lagi tebal nih. Surplus segini enaknya dialihkan ke tabungan darurat atau investasi.`,
      ],
      NEUTRAL: [
        `Sudah pakai ${Math.round(ratio * 100)}% dari pemasukan bulan ini. Masih oke, tapi jangan kebablasan ya.`,
        topCat
          ? `${topCat} jadi kategori paling banyak keluar. Coba dicek lagi perlu semua gak?`
          : `Pengeluaran mulai mendekati setengah pemasukan. Pantau terus ya!`,
      ],
      HAPPY: [
        `Mantap! Bulan ini pengeluaran masih ${Math.round(ratio * 100)}% dari pemasukan. Dompet makin sehat! 💪`,
        `Surplus ${formatRupiah(surplus)} bulan ini. Pertahankan gaya hidup hemat ini ya!`,
        topCat
          ? `Pengeluaran terbesar di kategori ${topCat}, tapi masih dalam batas aman. Bagus!`
          : `Keuangan bulan ini solid! Semangat terus.`,
      ],
    },
    en: {
      WELCOME: [
        `Welcome to your shared wallet! 🎉 Log your first transaction and I'll start tracking the condition.`,
        `No transactions yet. Add an expense or some income and I'll have something real to analyze.`,
      ],
      THINKING: [
        `You've spent ${formatRupiah(snap.expense, 'en')} but no income is recorded yet. Add your salary first so I can actually evaluate things.`,
        `I can't judge a wallet from expenses alone. Record your income and I'll give you the full picture.`,
      ],
      PANIC: [
        snap.balance < 0
          ? `Uh oh, balance is negative ${formatRupiah(Math.abs(snap.balance), 'en')}! Hit the brakes on spending. 🚨`
          : `Expenses have exceeded income this month! Critical — must take control now.`,
        `Try typing "roast my wallet" so I can provide a deeper analysis.`,
      ],
      REMINDER: [
        `Only ${safeDays} safe days left at an average of ${formatRupiah(Math.round(snap.expense / Math.max(new Date().getDate(), 3)), 'en')}/day. Ease off the pedal.`,
        `Heads up! At this pace the balance runs out before month end. Hold off on anything that can wait.`,
      ],
      WARNING: [
        `Careful! Already spent ${Math.round(ratio * 100)}% of income and the month isn't over yet.`,
        topCat
          ? `${topCat} takes the biggest share. Maybe time to cut back a bit there?`
          : `Spending is getting high. Think twice before splurging!`,
      ],
      RICH: [
        `Surplus of ${formatRupiah(surplus, 'en')} this month having used only ${Math.round(ratio * 100)}% of income. Impressive! 💰`,
        `Your wallet is loaded right now. A surplus like this is best redirected into an emergency fund or investments.`,
      ],
      NEUTRAL: [
        `Used ${Math.round(ratio * 100)}% of income this month. Still okay, but stay mindful.`,
        topCat
          ? `${topCat} is your largest expense category. Worth checking if all are needed?`
          : `Expenses nearing half your income. Keep monitoring!`,
      ],
      HAPPY: [
        `Awesome! Expenses are only ${Math.round(ratio * 100)}% of income this month. Wallet looking healthy! 💪`,
        `Surplus of ${formatRupiah(surplus, 'en')} this month. Keep up the frugal habits!`,
        topCat
          ? `Top expense is in ${topCat}, but still well within safe limits. Nice!`
          : `Solid finances this month! Keep it up.`,
      ],
    },
  };

  const statusLabels: Record<'id' | 'en', Record<MascotMood, string>> = {
    id: {
      WELCOME: 'Mulai catat transaksi pertama kamu',
      THINKING: 'Masukkan pemasukan biar bisa dinilai',
      PANIC: safeDays <= 0 ? 'Saldo habis / minus ⚠️' : `Hanya tersisa ${safeDays} hari!`,
      REMINDER: `Sisa aman tinggal ${safeDays} hari`,
      WARNING: `Sisa aman ~${safeDays} hari — hati-hati!`,
      RICH: safeDays >= 999 ? 'Surplus besar, super aman 🎉' : `Surplus ${formatRupiah(surplus)}`,
      NEUTRAL: `Aman untuk ~${safeDays} hari ke depan`,
      HAPPY: safeDays >= 999 ? 'Dompet super aman 🎉' : `Aman untuk ${safeDays} hari ke depan`,
    },
    en: {
      WELCOME: 'Log your first transaction to get started',
      THINKING: 'Add your income so I can evaluate',
      PANIC: safeDays <= 0 ? 'Out of funds / negative ⚠️' : `Only ${safeDays} days remaining!`,
      REMINDER: `Only ${safeDays} safe days left`,
      WARNING: `~${safeDays} safe days left — be cautious!`,
      RICH: safeDays >= 999 ? 'Huge surplus, super safe 🎉' : `Surplus of ${formatRupiah(surplus, 'en')}`,
      NEUTRAL: `Safe for ~${safeDays} days ahead`,
      HAPPY: safeDays >= 999 ? 'Wallet super safe 🎉' : `Safe for the next ${safeDays} days`,
    },
  };

  const cfg = configs[mood];
  const langKey = language === 'en' ? 'en' : 'id';
  const greetingList = greetings[langKey][mood];
  // Seed berbasis tanggal hari ini + mood agar sapaan stabil (tidak flicker tiap user tambah transaksi)
  const now = new Date();
  const daySeed = now.getDate() + (now.getMonth() + 1) * 31;
  const moodHash = mood.charCodeAt(0) + (mood.charCodeAt(1) || 0);
  const greetingIdx = Math.abs((daySeed + moodHash) % greetingList.length);
  const greeting = greetingList[greetingIdx];

  return {
    mood,
    ...cfg,
    moodLabel: moodLabels[langKey][mood],
    greeting,
    statusLabel: statusLabels[langKey][mood],
    safeDays,
  };
}

function formatRupiah(amount: number, language: 'id' | 'en' = 'id'): string {
  const abs = Math.abs(amount);
  const sep = language === 'en' ? ',' : '.';
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${amount < 0 ? '-' : ''}Rp ${formatted}`;
}

/** Mascot image assets per mood */
import type { ImageSourcePropType } from 'react-native';

export const MASCOT_IMAGES: Record<MascotMood, ImageSourcePropType> = {
  WELCOME:  require('../mascot/otter-welcome.png'),
  THINKING: require('../mascot/otter-thinking.png'),
  PANIC:    require('../mascot/otter-panic.png'),
  REMINDER: require('../mascot/otter-reminder.png'),
  WARNING:  require('../mascot/otter-warning.png'),
  RICH:     require('../mascot/otter-rich.png'),
  NEUTRAL:  require('../mascot/otter-idle.png'),
  HAPPY:    require('../mascot/otter-happy.png'),
};

export interface QuickChipItem {
  id: 'jajan' | 'bocor' | 'roast' | 'rangkum';
  label: string;
  prompt: string;
}

/** Quick action chips per language */
export function getQuickChips(language: 'id' | 'en' = 'id'): readonly QuickChipItem[] {
  if (language === 'en') {
    return [
      { id: 'jajan', label: '🍔 Can I splurge?', prompt: 'Can I treat myself today? Check my daily safe budget please.' },
      { id: 'bocor', label: '🔍 Check money leaks', prompt: 'Analyze small recurring expenses in this wallet. Any subtle leaks?' },
      { id: 'roast', label: '🔥 Roast my wallet', prompt: 'Roast my wallet in a sarcastic but educational way. Be honest!' },
      { id: 'rangkum', label: '📊 Weekly summary', prompt: 'Summarize this week financial condition based on the transaction data.' },
    ] as const;
  }
  return [
    { id: 'jajan', label: '🍔 Boleh jajan gak?', prompt: 'Boleh jajan gak hari ini? Cek sisa aman harian aku dong.' },
    { id: 'bocor', label: '🔍 Cek kebocoran halus', prompt: 'Analisis pengeluaran kecil yang berulang-ulang di dompet ini. Ada yang bocor halus gak?' },
    { id: 'roast', label: '🔥 Roast dompet gue', prompt: 'Roast dompet aku dengan gaya sarkas tapi mendidik. Jujur ya!' },
    { id: 'rangkum', label: '📊 Rangkum minggu ini', prompt: 'Buat ringkasan kondisi keuangan minggu ini berdasarkan data transaksi yang ada.' },
  ] as const;
}

export const QUICK_CHIPS = getQuickChips('id');

export type QuickChipId = 'jajan' | 'bocor' | 'roast' | 'rangkum';

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
  language: 'id' | 'en' = 'id',
): string {
  const ratio = snap.income > 0 ? snap.expense / snap.income : snap.expense > 0 ? 2 : 0;
  const pctStr = `${Math.round(ratio * 100)}%`;
  const today = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - today;
  const dailyBudget = snap.income > 0 ? Math.floor((snap.income - snap.expense) / Math.max(daysLeft, 1)) : 0;
  const surplus = snap.income - snap.expense;
  const safeDays = calcSafeDays(snap.expense, snap.balance);
  const topCat = Object.entries(snap.byCategory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const templatesId: Record<QuickChipId, Record<MascotMood, string>> = {
    jajan: {
      WELCOME: `Belum ada transaksi sama sekali, jadi belum ada angka yang bisa aku pakai buat ngitung budget jajan. Catat satu transaksi dulu ya!`,
      THINKING: `Belum ada pemasukan tercatat bulan ini. Masukkan dulu data gaji/pemasukan biar aku bisa hitung budget jajan kamu!`,
      PANIC: `Jajan? Jangan dulu! 🚨 Pengeluaran sudah melampaui pemasukan atau saldo tipis. Prioritas sekarang: rem pengeluaran dan cari tambahan pemasukan!`,
      REMINDER: `Sisa aman tinggal ${safeDays} hari — mending tahan dulu. Kalau tetap mau jajan, sisihkan dulu biaya kebutuhan sampai akhir bulan ya.`,
      WARNING: `Hm, sebaiknya tahan dulu. Pengeluaran sudah ${pctStr} dari pemasukan dan bulan belum selesai. Kalau jajan, pilih yang murah meriah saja ya — jangan yang bisa bikin jebol! 😅`,
      RICH: dailyBudget > 0
        ? `Boleh banget! Surplus ${fmtRp(surplus)} dan sisa harian ~${fmtRp(dailyBudget)}/hari. Dompet lagi tebal — asal tetap sesuai budget, gas aja! 🍔`
        : `Surplusnya besar, tapi catat pemasukan dulu biar aku bisa hitung batas harian yang tepat.`,
      NEUTRAL: dailyBudget > 0
        ? `Boleh jajan, tapi jangan terlalu banyak. Sisa harian sekitar ${fmtRp(dailyBudget)}/hari. Sudah pakai ${pctStr} dari pemasukan — masih oke, tapi hati-hati.`
        : `Catat dulu pemasukan kamu biar aku bisa hitung sisa harian ya!`,
      HAPPY: dailyBudget > 0
        ? `Boleh banget! Sisa harian kamu sekitar ${fmtRp(dailyBudget)}/hari sampai akhir bulan. Pengeluaran baru ${pctStr} dari pemasukan, dompet masih sehat. Tapi tetap wajar ya! 🍔`
        : `Kamu belum punya pemasukan tercatat bulan ini. Masukkan dulu data gaji/pemasukan biar aku bisa hitung budget jajan kamu!`,
    },
    bocor: {
      WELCOME: `Belum ada transaksi sama sekali, jadi belum ada bocoran yang bisa dilacak. Catat pengeluaran pertamamu dan aku bakal mulai memantau polanya.`,
      THINKING: `Pengeluaran ${fmtRp(snap.expense)} tercatat, tapi belum ada pemasukan sebagai patokan. Masukkan dulu datanya — tanpa itu aku belum bisa bilang mana yang bocor dan mana yang wajar.`,
      PANIC: `Darurat! 🚨 Total pengeluaran ${fmtRp(snap.expense)} vs pemasukan ${fmtRp(snap.income)}. ${topCat ? `Kategori ${topCat} jadi yang terbesar.` : ''} Segera stop pengeluaran tidak penting dan review semua transaksi bulan ini!`,
      REMINDER: `Barisan aman tinggal ${safeDays} hari. ${topCat ? `${topCat} masih jadi pos terbesar (${fmtRp(snap.byCategory[topCat] ?? 0)}).` : ''} Coba telusuri pengeluaran minggu ini sebelum kebiasaan itunya menumpuk.`,
      WARNING: topCat
        ? `Waspada! ${topCat} sudah menyedot ${fmtRp(snap.byCategory[topCat] ?? 0)} — kemungkinan di sini ada kebocoran halus. Coba tinjau ulang transaksi di kategori ini minggu lalu.`
        : `Pengeluaran total sudah ${pctStr} dari pemasukan. Coba audit transaksi kecil berulang — langganan streaming, jajan mingguan, dll.`,
      RICH: surplus > 0
        ? `Dompet lagi tebal tapi tetap cek ${topCat ? `${topCat} (${fmtRp(snap.byCategory[topCat] ?? 0)}) — duit banyak gak artinya pengeluarannya wajar.` : `pengeluaran harianmu — duit banyak gak artinya gak bocor.`}`
        : `Surplus besar bulan ini, tidak ada kebocoran yang mencolok. Cuma pastikan pengeluaran rutinmu memang semua terencana.`,
      NEUTRAL: topCat
        ? `Kategori ${topCat} menyedot paling banyak (${fmtRp(snap.byCategory[topCat] ?? 0)}). Coba cek, apakah ada langganan atau pembelian kecil yang berulang di sana? Hal-hal kecil kalau dijumlah bisa besar.`
        : `Tidak ada kategori yang mencolok. Meskipun begitu, perhatikan pengeluaran harian kecil — kopi, parkir, dll. — karena bisa bocor halus.`,
      HAPPY: topCat
        ? `Secara umum dompet sehat. Tapi aku lihat ${topCat} jadi kategori terbesar (${fmtRp(snap.byCategory[topCat] ?? 0)}). Pastikan pengeluaran di sana memang terencana ya, bukan impulsif!`
        : `Pengeluaran bulan ini terlihat terdistribusi dengan baik. Tidak ada kategori yang terlihat bocor. Pertahankan!`,
    },
    roast: {
      WELCOME: `Gak ada satu pun transaksi buat di-roast. Kamu datang ke penista keuangan tanpa dosa. Datang lagi kalau udah mulai jajan ya. 👋`,
      THINKING: `Habis ${fmtRp(snap.expense)} tanpa satu rupiah pun pemasukan tercatat. Ini bukan dompet, ini bolongan. Itu yang mau aku roast, tapi ya udah aku sebut juga sekarang.`,
      PANIC: snap.balance < 0
        ? `Saldo MINUS ${formatRupiah(Math.abs(snap.balance))} 🚨. Ini bukan lagi di-roast, ini lagi dibedah. Tutup dompet, buka spreadsheet, urus dulu.`
        : `Pengeluaran udah melampaui pemasukan ${fmtRp(snap.expense)} vs ${fmtRp(snap.income)}. Ini bukan roast, ini alarm kebakaran dompet! Segera evaluasi dan potong pengeluaran!`,
      REMINDER: `Barisan aman tinggal ${safeDays} hari. Gak kritis, tapi hari tuamu di bulan ini dihitung jari sekarang. Mau berhenti boros atau mau terus diitung sama aku?`,
      WARNING: `*Tarik napas dalam*... ${pctStr} udah habis dan masih ada ${Math.max(new Date().getDate(), 1)} hari lagi. Kamu makan siang atau makan masa depan?`,
      RICH: `Surplus ${formatRupiah(surplus)} bulan ini. Tumben. Beneran, tumben. Jangan dikira aku gak bisa lihat — aku cuma gak nyangka kamu segini mampunya. 💰`,
      NEUTRAL: topCat
        ? `Oke, ${pctStr} pemasukan udah habis dan bulan belum kelar. Kategori ${topCat} jadi biang kerok. Serius, kamu pikir ${topCat} itu investasi? Itu pengeluaran! Yuk kurangin sedikit.`
        : `${pctStr} pemasukan udah melayang dan bulan masih jalan. Dompet kamu kayak es krim di siang hari — mencair pelan-pelan. Awas ya!`,
      HAPPY: surplus > 0
        ? `Dompet kamu... *cukup membosankan*. Pengeluaran cuma ${pctStr} dari pemasukan dan surplus ${fmtRp(surplus)}. Serius? Kamu ini irit banget atau memang gak ada yang mau dibeliin? 😄 Pertahankan — ini langka!`
        : `Dompet kamu... tidak ada yang perlu di-roast. Saldo oke, pengeluaran terkendali. Aku menyerah mencari bahan roast-nya.`,
    },
    rangkum: {
      WELCOME: `📊 Status dompet:
• Pemasukan: ${fmtRp(snap.income)}
• Pengeluaran: ${fmtRp(snap.expense)}
• Transaksi: ${snap.count}

Belum ada apa-apa yang bisa dirangkum. Catat transaksi pertama dan ringkasan otomatisnya bakal lengkap.`,
      THINKING: `📊 Status dompet (belum lengkap):
• Pemasukan: ${fmtRp(snap.income)} — belum tercatat
• Pengeluaran: ${fmtRp(snap.expense)}
• Transaksi: ${snap.count}

Tanpa data pemasukan aku belum bisa kasih analisis kondisi. Tambah satu transaksi pemasukan ya.`,
      PANIC: `🚨 Status dompet KRITIS:
• Pemasukan: ${fmtRp(snap.income)}
• Pengeluaran: ${fmtRp(snap.expense)}
• Surplus: ${fmtRp(surplus)}
• Barisan aman: ${safeDays} hari
${snap.balance < 0 ? `• Saldo: ${fmtRp(snap.balance)} (MINUS)` : ''}
Prioritas sekarang: rem pengeluaran dan cari tambahan pemasukan.`,
      REMINDER: `⚠️ Pengingat dompet:
• Pemasukan: ${fmtRp(snap.income)}
• Pengeluaran: ${fmtRp(snap.expense)} (${pctStr})
• Barisan aman: tinggal ${safeDays} hari
Masih belum kritis, tapi mulai sekarang pengeluaran kecil udah berasa.`,
      WARNING: `⚠️ Status dompet:
• Pemasukan: ${fmtRp(snap.income)}
• Pengeluaran: ${fmtRp(snap.expense)} (${pctStr})
• Surplus: ${fmtRp(surplus)}
Bulan belum selesai, tapi ${pctStr} udah kepakai. Awas kebablasan.`,
      RICH: `💰 Status dompet:
• Pemasukan: ${fmtRp(snap.income)}
• Pengeluaran: ${fmtRp(snap.expense)} (${pctStr})
• Surplus: ${fmtRp(surplus)}
Barisan aman: ${safeDays} hari${safeDays >= 999 ? ' (super aman)' : ''}. Dompet lagi tebal banget bulan ini.`,
      NEUTRAL: `📊 Status dompet:
• Pemasukan: ${fmtRp(snap.income)}
• Pengeluaran: ${fmtRp(snap.expense)} (${pctStr})
• Surplus: ${fmtRp(surplus)}
• Barisan aman: ${safeDays} hari

Masih dalam batas aman.`,
      HAPPY: `📊 Ringkasan bulan ini:\n• Pemasukan: ${fmtRp(snap.income)}\n• Pengeluaran: ${fmtRp(snap.expense)} (${pctStr})\n• Sisa: ${fmtRp(surplus)}\n• Total transaksi: ${snap.count}\n${topCat ? `• Terbesar: ${topCat} (${fmtRp(snap.byCategory[topCat] ?? 0)})` : ''}\n\nKondisi: SEHAT! Pertahankan gaya hidup hemat ini. 💚`,
    },
  };

  const templatesEn: Record<QuickChipId, Record<MascotMood, string>> = {
    jajan: {
      WELCOME: `There are no transactions at all yet, so I have no numbers to work with for your treat budget. Log a transaction first!`,
      THINKING: `No income recorded this month. Add your salary data first so I can calculate your treat budget!`,
      PANIC: `Treat yourself? Not now! 🚨 Expenses have exceeded income or balance is tight. Priority now: hit the brakes and find additional income!`,
      REMINDER: `Only ${safeDays} safe days left — better hold off. If you really want to treat yourself, set aside the essentials through month end first.`,
      WARNING: `Hmm, better hold off. Expenses are at ${pctStr} of income and the month isn't over yet. If you do treat yourself, pick something budget-friendly — don't go overboard! 😅`,
      RICH: dailyBudget > 0
        ? `Absolutely! Surplus of ${formatRupiah(surplus, 'en')} and about ${formatRupiah(dailyBudget, 'en')}/day left. Wallet is loaded — as long as it stays within budget, go for it! 🍔`
        : `The surplus is large, but record your income first so I can calculate the right daily cap.`,
      NEUTRAL: dailyBudget > 0
        ? `You can treat yourself, but not too much. Daily allowance is about ${formatRupiah(dailyBudget, 'en')}/day. Used ${pctStr} of income — still okay, but be careful.`
        : `Record your income first so I can calculate the daily allowance!`,
      HAPPY: dailyBudget > 0
        ? `Go for it! Your daily remaining allowance is ~${fmtRp(dailyBudget)}/day until the end of the month. Spending is only ${pctStr} of income, wallet is super healthy. Keep it reasonable though! 🍔`
        : `No income recorded yet for this month. Please add your salary/income first so I can calculate your daily budget!`,
    },
    bocor: {
      WELCOME: `There are no transactions yet, so there is no leak to trace. Log your first expense and I'll start watching the patterns.`,
      THINKING: `${formatRupiah(snap.expense, 'en')} in expenses is recorded, but there is no income to compare against. Add that data first — without it I can't tell what is leaking and what is normal.`,
      PANIC: `Emergency! 🚨 Total expenses ${formatRupiah(snap.expense, 'en')} vs income ${formatRupiah(snap.income, 'en')}. ${topCat ? `${topCat} category is the biggest drain.` : ''} Immediately stop unnecessary spending and review all transactions this month!`,
      REMINDER: `Only ${safeDays} safe days left. ${topCat ? `${topCat} is still the largest line item (${formatRupiah(snap.byCategory[topCat] ?? 0, 'en')}).` : ''} Trace this week's spending before small habits pile up.`,
      WARNING: topCat
        ? `Watch out! ${topCat} has eaten up ${formatRupiah(snap.byCategory[topCat] ?? 0, 'en')} — there's likely a subtle leak there. Try reviewing transactions in that category from last week.`
        : `Total expenses are at ${pctStr} of income. Try auditing small recurring transactions — subscriptions, weekly treats, etc.`,
      RICH: surplus > 0
        ? `Wallet is loaded but still check ${topCat ? `${topCat} (${formatRupiah(snap.byCategory[topCat] ?? 0, 'en')}) — plenty of money doesn't make spending normal.` : `your daily spending — plenty of money doesn't mean nothing is leaking.`}`
        : `Large surplus this month, nothing obvious is leaking. Just make sure your regular expenses are all intentional.`,
      NEUTRAL: topCat
        ? `The ${topCat} category takes the biggest bite (${formatRupiah(snap.byCategory[topCat] ?? 0, 'en')}). Check if there are any subscriptions or small recurring purchases there? Small things add up to a lot.`
        : `No category stands out. Even so, watch small daily expenses — coffee, parking, etc. — because they can leak slowly.`,
      HAPPY: topCat
        ? `Overall wallet looks healthy. However, ${topCat} is your largest category (${fmtRp(snap.byCategory[topCat] ?? 0)}). Make sure those expenses are planned, not impulsive!`
        : `Expenses this month look nicely distributed. No noticeable leak detected. Keep it up!`,
    },
    roast: {
      WELCOME: `Not a single transaction to roast. You came to the finance mocker with a clean record. Come back once you start spending. 👋`,
      THINKING: `${formatRupiah(snap.expense, 'en')} spent without a single rupiah of income recorded. That's not a wallet, that's a hole. That's what I'd have roasted, but there — I said it anyway.`,
      PANIC: snap.balance < 0
        ? `Balance NEGATIVE ${formatRupiah(Math.abs(snap.balance), 'en')} 🚨. This isn't a roast anymore, this is surgery. Close the wallet, open the spreadsheet, deal with it.`
        : `Expenses have exceeded income ${formatRupiah(snap.expense, 'en')} vs ${formatRupiah(snap.income, 'en')}. This isn't a roast, it's a wallet fire alarm! Evaluate immediately and cut expenses!`,
      REMINDER: `Only ${safeDays} safe days left. Not critical, but your days this month are being counted on fingers now. Quit being wasteful or keep letting me count?`,
      WARNING: `*Takes a deep breath*... ${pctStr} already spent and ${Math.max(new Date().getDate(), 1)} days still left. Are you eating lunch or eating your future?`,
      RICH: `Surplus of ${formatRupiah(surplus, 'en')} this month. First time for everything. Really. Don't think I didn't notice — I just didn't expect this much from you. 💰`,
      NEUTRAL: topCat
        ? `Okay, ${pctStr} of income is already gone and the month isn't finished. The ${topCat} category is the culprit. Really, do you think ${topCat} is an investment? That's an expense! Let's cut it down a bit.`
        : `${pctStr} of your income has floated away and the month is still going. Your wallet is like ice cream on a sunny day — slowly melting. Watch out!`,
      HAPPY: surplus > 0
        ? `Your wallet is... *kind of boring*. Spending is merely ${pctStr} of income with a surplus of ${fmtRp(surplus)}. Are you extremely disciplined or just have nothing to buy? 😄 Keep it up — this is rare!`
        : `Your wallet is... unroastable right now. Good balance, controlled spending. I give up trying to roast you.`,
    },
    rangkum: {
      WELCOME: `📊 Wallet status:
• Income: ${formatRupiah(snap.income, 'en')}
• Expenses: ${formatRupiah(snap.expense, 'en')}
• Transactions: ${snap.count}

There's nothing to summarize yet. Log your first transaction and the automatic summary fills in.`,
      THINKING: `📊 Wallet status (incomplete):
• Income: ${formatRupiah(snap.income, 'en')} — not recorded yet
• Expenses: ${formatRupiah(snap.expense, 'en')}
• Transactions: ${snap.count}

Without income data I can't give you a real condition read. Add one income transaction.`,
      PANIC: `🚨 CRITICAL wallet status:
• Income: ${formatRupiah(snap.income, 'en')}
• Expenses: ${formatRupiah(snap.expense, 'en')}
• Surplus: ${formatRupiah(surplus, 'en')}
• Safe runway: ${safeDays} days
${snap.balance < 0 ? `• Balance: ${formatRupiah(snap.balance, 'en')} (NEGATIVE)` : ''}
Priority now: cut expenses and find additional income.`,
      REMINDER: `⚠️ Wallet reminder:
• Income: ${formatRupiah(snap.income, 'en')}
• Expenses: ${formatRupiah(snap.expense, 'en')} (${pctStr})
• Safe runway: ${safeDays} days left
Still not critical, but small expenses already bite from here on.`,
      WARNING: `⚠️ Wallet status:
• Income: ${formatRupiah(snap.income, 'en')}
• Expenses: ${formatRupiah(snap.expense, 'en')} (${pctStr})
• Surplus: ${formatRupiah(surplus, 'en')}
Month isn't over, but ${pctStr} is already used. Don't overshoot.`,
      RICH: `💰 Wallet status:
• Income: ${formatRupiah(snap.income, 'en')}
• Expenses: ${formatRupiah(snap.expense, 'en')} (${pctStr})
• Surplus: ${formatRupiah(surplus, 'en')}
Safe runway: ${safeDays} days${safeDays >= 999 ? ' (super safe)' : ''}. The wallet is very full this month.`,
      NEUTRAL: `📊 Wallet status:
• Income: ${formatRupiah(snap.income, 'en')}
• Expenses: ${formatRupiah(snap.expense, 'en')} (${pctStr})
• Surplus: ${formatRupiah(surplus, 'en')}
• Safe runway: ${safeDays} days

Still within safe limits.`,
      HAPPY: `📊 Monthly Summary:\n• Income: ${fmtRp(snap.income)}\n• Expense: ${fmtRp(snap.expense)} (${pctStr})\n• Remaining: ${fmtRp(surplus)}\n• Total transactions: ${snap.count}\n${topCat ? `• Top Category: ${topCat} (${fmtRp(snap.byCategory[topCat] ?? 0)})` : ''}\n\nCondition: HEALTHY! Keep up the frugal mindset. 💚`,
    },
  };

  const templates = language === 'en' ? templatesEn : templatesId;
  return templates[chipId][mood];
}

/** Fallback untuk input teks bebas berdasarkan kata kunci */
export function getFallbackFreeResponse(
  text: string,
  snap: FinancialSnapshot,
  mood: MascotMood,
  language: 'id' | 'en' = 'id',
): string {
  const lower = text.toLowerCase();
  const surplus = snap.income - snap.expense;
  const ratio = snap.income > 0 ? snap.expense / snap.income : snap.expense > 0 ? 2 : 0;
  const pctStr = `${Math.round(ratio * 100)}%`;

  if (language === 'en') {
    // English free text detection
    if (/\b(snack|treat|buy|can i buy|spend|afford|shopping)\b/.test(lower)) {
      const today = new Date().getDate();
      const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - today;
      const daily = snap.income > 0 ? Math.floor((snap.income - snap.expense) / Math.max(daysLeft, 1)) : 0;
      if (mood === 'WELCOME' || mood === 'THINKING') {
        return `${mood === 'WELCOME' ? 'No transactions yet, so there is no budget to calculate.' : 'No income recorded yet, so there is no budget to calculate.'} Log a transaction or add your income first and I can give you a real daily number.`;
      }
      if (mood === 'REMINDER') {
        const runway = calcSafeDays(snap.expense, snap.balance);
        return `Only ${runway} safe days left this month — hold off on non-essentials. Spending is already ${pctStr} of income and about Rp ${daily.toLocaleString('en-US')}/day remains.`;
      }
      if (mood === 'RICH') {
        return `Wallet is in great shape — surplus of Rp ${surplus.toLocaleString('en-US')} and about Rp ${daily.toLocaleString('en-US')}/day left. Go ahead as long as it fits your plan!`;
      }
      if (mood === 'HAPPY' || mood === 'NEUTRAL') {
        return daily > 0
          ? `Your daily safe budget is ~Rp ${daily.toLocaleString('en-US')}/day. With your ${mood === 'HAPPY' ? 'healthy' : 'stable'} finances, go ahead — as long as it fits your budget!`
          : `No income recorded yet. Please enter your income/salary first so I can calculate your daily budget.`;
      }
      return `Financial status is currently in ${mood === 'WARNING' ? 'caution' : 'critical'} zone. Please hold off on new purchases. Spending is already ${pctStr} of income!`;
    }

    if (/\b(balance|money|funds|remaining|cash)\b/.test(lower)) {
      return `Current balance: ${surplus >= 0 ? 'Rp ' + surplus.toLocaleString('en-US') : '−Rp ' + Math.abs(surplus).toLocaleString('en-US')}.\nIncome: ${snap.income > 0 ? 'Rp ' + snap.income.toLocaleString('en-US') : 'not recorded'}, expenses: Rp ${snap.expense.toLocaleString('en-US')} (${pctStr}).`;
    }

    if (/\b(tip|tips|advice|suggest|how to)\b/.test(lower)) {
      const tipsEn: Record<MascotMood, string> = {
        WELCOME: '💡 First step: log every transaction for a week. Nothing gets better until the data exists — I cannot advise on an empty wallet.',
        THINKING: '💡 Add your income so I can work with real ratios. Expenses alone never tell you whether you are actually okay.',
        PANIC: '🚨 Emergency steps: (1) Stop all non-essential spending today, (2) Sell unused items, (3) Seek assistance if your balance is negative.',
        REMINDER: '💡 Your runway is down to a few days. Push anything non-essential into next month and work out where this month actually went.',
        WARNING: '💡 Prioritize: (1) Pay off high-interest debt/bills, (2) Trim non-essential expenses first, (3) Look for side income if possible.',
        RICH: '💡 Automate it: move a fixed amount into savings the day income lands, before you get the chance to spend it.',
        NEUTRAL: '💡 Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings. Your spending is in a sensible range, focus on consistency!',
        HAPPY: '💡 Since your wallet is healthy, now is the perfect time to build your emergency fund — ideally 3–6× monthly expenses. Auto-save at the start of every month!',
      };
      return tipsEn[mood];
    }

    const genericEn: Record<MascotMood, string> = {
      WELCOME: `No transactions yet, so there is nothing to evaluate. Log your first transaction and I start tracking your wallet condition. Try the quick chips above once data exists.`,
      THINKING: `Expenses are ${pctStr} but no income is recorded, so I cannot read the condition honestly. Add your income and I will give you a real analysis.`,
      PANIC: `🚨 Critical condition! Spending exceeds income. Review your transactions and cut back immediately. AI is offline, but this warning is based on your real data.`,
      REMINDER: `Only ${calcSafeDays(snap.expense, snap.balance)} safe days left. Not critical yet, but spending of ${pctStr} means small purchases now matter. Use the chips above.`,
      WARNING: `Caution — spending has reached ${pctStr}! Use the chips above for quick analysis. AI is offline, but I can give a solid overview from your transactions.`,
      RICH: `Wallet is in great shape — surplus of ${formatRupiah(surplus, 'en')} with only ${pctStr} of income spent. Ask the chips above what to do with it.`,
      NEUTRAL: `Condition is stable. Spending has reached ${pctStr} of income. Use the quick chips above for specific advice — AI is offline, but analysis templates are active.`,
      HAPPY: `Your wallet is healthy! Income ${snap.income > 0 ? 'Rp ' + snap.income.toLocaleString('en-US') : '(not recorded)'}, expenses ${pctStr}. Try asking with quick chips above — AI assistant is offline, but I can help using current data.`,
    };
    return genericEn[mood];
  }

  // Deteksi kata kunci umum (Indonesian)
  if (/\b(jajan|makan|beli|bisa beli|boleh)\b/.test(lower)) {
    const today = new Date().getDate();
    const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - today;
    const daily = snap.income > 0 ? Math.floor((snap.income - snap.expense) / Math.max(daysLeft, 1)) : 0;
    if (mood === 'WELCOME' || mood === 'THINKING') {
      return `${mood === 'WELCOME' ? 'Belum ada transaksi sama sekali, jadi budget hariannya belum bisa dihitung.' : 'Pemasukan belum tercatat, jadi budget hariannya belum bisa dihitung.'} Catat satu transaksi atau masukkan pemasukan dulu dan aku bisa kasih angka harian yang bener.`;
    }
    if (mood === 'REMINDER') {
      const runway = calcSafeDays(snap.expense, snap.balance);
      return `Barisan aman tinggal ${runway} hari bulan ini — tahan dulu yang bukan kebutuhan. Pengeluaran sudah ${pctStr} dari pemasukan dan sisa Rp ${daily.toLocaleString('id-ID')}/hari.`;
    }
    if (mood === 'RICH') {
      return `Dompet lagi tebal — surplus Rp ${surplus.toLocaleString('id-ID')} dan sisa Rp ${daily.toLocaleString('id-ID')}/hari. Boleh aja, asal tetap sesuai rencana ya!`;
    }
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
      WELCOME: '💡 Langkah pertama: catat semua transaksi selama sepekan. Nggak ada yang berubah kalau datanya belum ada — aku nggak bisa ngasih saran ke dompet kosong.',
      THINKING: '💡 Masukkan pemasukannya dulu supaya rasionya jujur. Pengeluaran sendirian nggak pernah bilang kamu aman atau nggak.',
      PANIC: '🚨 Langkah darurat: (1) Stop semua pengeluaran non-esensial hari ini, (2) Jual barang yang tidak terpakai, (3) Cari bantuan atau pinjaman darurat jika saldo minus.',
      REMINDER: '💡 Barisan aman tinggal beberapa hari. Tahan dulu yang bukan kebutuhan ke bulan depan, dan cari tahu sebenarnya bulan ini duitnya lari ke mana.',
      WARNING: '💡 Prioritaskan: (1) Lunasi cicilan/tagihan penting, (2) Kurangi pengeluaran tersier dulu, (3) Cari penghasilan tambahan jika bisa.',
      RICH: '💡 Otomatisin: sisihkan sejumlah tetap ke tabungan begitu pemasukan masuk, sebelum sempat kepakai.',
      NEUTRAL: '💡 Coba metode 50/30/20: 50% kebutuhan, 30% keinginan, 20% tabungan. Pengeluaranmu sudah di angka wajar, tinggal konsistensi!',
      HAPPY: '💡 Karena dompet sedang sehat, ini waktu tepat untuk mulai tabungan darurat — idealnya 3–6× pengeluaran bulanan. Sisihkan otomatis di awal bulan!',
    };
    return tips[mood];
  }

  // Generic fallback berdasarkan mood
  const generic: Record<MascotMood, string> = {
    WELCOME: `Belum ada transaksi sama sekali, jadi belum ada yang bisa dinilai. Catat transaksi pertamamu dan aku mulai memantau kondisi dompet. Kalau udah ada data, coba chip tanya cepat di atas.`,
    THINKING: `Pengeluaran ${pctStr} tapi pemasukan belum tercatat, jadi aku nggak bisa baca kondisinya dengan jujur. Masukkan pemasukannya dan aku kasih analisis yang bener.`,
    PANIC: `🚨 Kondisi kritis! Pengeluaran melampaui pemasukan. Segera review transaksi dan rem pengeluaran. AI offline, tapi peringatan ini berdasarkan data nyata kamu.`,
    REMINDER: `Barisan aman tinggal ${calcSafeDays(snap.expense, snap.balance)} hari. Belum kritis, tapi pengeluaran ${pctStr} artinya belanja kecil sekarang udah berasa. Pakai chip di atas.`,
    WARNING: `Waspada — pengeluaran sudah ${pctStr}! Gunakan chip di atas untuk analisis cepat. AI sedang offline, tapi aku tetap bisa kasih gambaran umum dari data transaksimu.`,
    RICH: `Dompet lagi tebal — surplus ${formatRupiah(surplus)} dengan ${pctStr} pemasukan kepakai. Tanya chip di atas mau diapain.`,
    NEUTRAL: `Kondisi stabil. Pengeluaran sudah ${pctStr} dari pemasukan. Gunakan chip tanya cepat di atas untuk saran spesifik — AI sedang offline, tapi template analisis tetap aktif.`,
    HAPPY: `Dompet sedang sehat! Pemasukan ${snap.income > 0 ? 'Rp ' + snap.income.toLocaleString('id-ID') : '(belum tercatat)'}, pengeluaran ${pctStr}. Kalau ada pertanyaan spesifik, coba chip "Boleh jajan?" atau "Roast dompet gue" ya — AI asisten sedang offline, tapi aku bisa bantu dengan data yang ada.`,
  };
  return generic[mood];
}
