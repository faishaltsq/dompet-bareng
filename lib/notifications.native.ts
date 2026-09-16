/**
 * lib/notifications.native.ts — Native implementation (iOS & Android)
 * Wraps expo-notifications with try/catch to gracefully degrade in Expo Go (SDK 53+).
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const REMINDER_KEY = '@db:daily_reminder_enabled';

let Notifications: typeof import('expo-notifications') | null = null;

try {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // expo-notifications unavailable (Expo Go SDK 53+) — all functions become no-ops
}

// ── Pool pesan harian yang bervariasi ────────────────────────────────────────

type ReminderTemplate = { title: string; body: string };

const REMINDER_POOL: ReminderTemplate[] = [
  {
    title: '🦦 Otter nagih catatan!',
    body: 'Hei! Jangan lupa catat pengeluaran hari ini sebelum ketinggalan ya~',
  },
  {
    title: '💰 DompetBareng mengingatkan',
    body: 'Sudah catat semua transaksi hari ini? Yuk update sekarang biar dompet bersama tetap rapi!',
  },
  {
    title: '📊 Waktunya audit harian!',
    body: 'Berapa yang keluar hari ini? Catat sekarang sebelum lupa — 30 detik cukup!',
  },
  {
    title: '🦦 Otter mau tidur, tapi...',
    body: 'Transaksi hari ini sudah dicatat belum? Otter tidak bisa tidur kalau dompet belum rapi 😅',
  },
  {
    title: '💸 Bocor di mana nih?',
    body: 'Hari ini beli apa saja? Catat di DompetBareng supaya kamu tahu uang kemana perginya!',
  },
  {
    title: '📝 Catatan keuangan menunggu',
    body: 'Satu catatan kecil hari ini = kontrol keuangan yang lebih baik besok. Yuk catat!',
  },
  {
    title: '🦦 Ping dari Otter Finansial!',
    body: 'Anggota dompet kamu menunggu laporan harian. Catat transaksimu sekarang!',
  },
  {
    title: '✅ Checklist malam ini',
    body: 'Makan ✓  Kerja ✓  Catat keuangan... belum? Ayo buka DompetBareng sebentar!',
  },
  {
    title: '🎯 Target keuangan dalam genggaman',
    body: 'Konsisten mencatat = lebih mudah hemat. Tambahkan transaksi hari ini yuk!',
  },
  {
    title: '🔔 Pengingat DompetBareng',
    body: 'Jangan sampai lupa pengeluaran tadi! Catat sekarang sebelum memory hilang 😄',
  },
  {
    title: '🦦 Otter bertanya...',
    body: 'Hari ini makan di luar, belanja, atau isi bensin? Yuk catat biar dompet bersama transparan!',
  },
  {
    title: '💡 Tips hemat malam ini',
    body: 'Langkah pertama hemat adalah tahu ke mana uang pergi. Catat transaksi hari ini!',
  },
  {
    title: '🌙 Sebelum tidur...',
    body: 'Luangkan 1 menit untuk catat pengeluaran hari ini di DompetBareng. Besok pasti lega!',
  },
  {
    title: '🤝 Dompet bersama, tanggung bersama',
    body: 'Transparansi finansial dimulai dari catatan harian. Sudah catat hari ini?',
  },
  {
    title: '📱 Update dompet yuk!',
    body: 'Anggota dompetmu menunggu laporan. Catat pengeluaran hari ini — cepat dan mudah!',
  },
];

/** Pilih pesan acak dari pool */
function pickRandomReminder(): ReminderTemplate {
  return REMINDER_POOL[Math.floor(Math.random() * REMINDER_POOL.length)];
}

// ── Fungsi utama ─────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-reminder', {
        name: 'Pengingat Harian',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

/** Simpan entri ke histori notifikasi Supabase */
async function saveToHistory(title: string, body: string): Promise<void> {
  try {
    // Ambil user session aktif
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('notifications').insert({
      user_id: user.id,
      title,
      message: body,
      type: 'daily_reminder',
      is_read: false,
      data: { source: 'scheduled_reminder' },
    });
  } catch {
    // Silently fail — histori opsional, tidak boleh ganggu notifikasi utama
  }
}

export async function scheduleDailyReminder(hour = 20, minute = 0): Promise<void> {
  if (!Notifications) return;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    // Pilih pesan acak untuk jadwal berikutnya
    const msg = pickRandomReminder();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body: msg.body,
        sound: 'default',
        data: { type: 'daily_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: Platform.OS === 'android' ? 'daily-reminder' : undefined,
      },
    });

    await AsyncStorage.setItem(REMINDER_KEY, 'true');

    // Simpan ke histori — gunakan pesan yang sama dengan yang dijadwalkan
    await saveToHistory(msg.title, msg.body);
  } catch {
    // Silently fail
  }
}

/** Dipanggil oleh listener notifikasi ketika notif harian diterima — rotasi pesan + simpan histori */
export async function onDailyReminderReceived(): Promise<void> {
  const msg = pickRandomReminder();
  await saveToHistory(msg.title, msg.body);

  // Reschedule dengan pesan baru agar besok beda lagi
  try {
    const stored = await AsyncStorage.getItem(REMINDER_KEY);
    if (stored !== 'true' || !Notifications) return;

    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body: msg.body,
        sound: 'default',
        data: { type: 'daily_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
        channelId: Platform.OS === 'android' ? 'daily-reminder' : undefined,
      },
    });
  } catch {}
}

export async function cancelAllReminders(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem(REMINDER_KEY, 'false');
  } catch {
    // Silently fail
  }
}

export async function isReminderEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(REMINDER_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function sendTestNotification(): Promise<void> {
  if (!Notifications) return;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const msg = pickRandomReminder();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title + ' (Test)',
        body: msg.body,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3,
        repeats: false,
      },
    });

    // Simpan juga ke histori
    await saveToHistory(msg.title + ' (Test)', msg.body);
  } catch (e) {
    console.error('sendTestNotification error:', e);
  }
}
