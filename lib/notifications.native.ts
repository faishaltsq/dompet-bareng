/**
 * lib/notifications.native.ts — Native implementation (iOS & Android)
 * Wraps expo-notifications with try/catch to gracefully degrade in Expo Go (SDK 53+).
 */

import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  // silent fallback, avoid modal warning in dev
}

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

export async function scheduleDailyReminder(hour = 20, minute = 0): Promise<void> {
  if (!Notifications) return;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'DompetBareng 💰',
        body: 'Ada pengeluaran hari ini? Yuk catat sekarang agar keuangan barengan tetap rapi!',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: Platform.OS === 'android' ? 'daily-reminder' : undefined,
      },
    });

    await AsyncStorage.setItem(REMINDER_KEY, 'true');
  } catch {
    // Silently fail
  }
}

export async function sendTestNotification(): Promise<void> {
  if (!Notifications) {
    Alert.alert(
      'Mode Expo Go',
      'Fitur notifikasi dinonaktifkan di Expo Go oleh Expo SDK 53+. Fitur ini akan aktif otomatis ketika di-build jadi APK (Development Build).'
    );
    return;
  }

  try {
    const granted = await requestNotificationPermission();
    if (!granted) {
      console.warn('Notification permission not granted');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'DompetBareng 💰 (Test)',
        body: 'Notifikasi pengingat berhasil! Kamu akan diingatkan setiap hari jam 20:00.',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3,
        repeats: false,
      },
    });

    console.log('Test notification scheduled — akan muncul dalam 3 detik');
  } catch (e) {
    console.error('sendTestNotification error:', e);
  }
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
