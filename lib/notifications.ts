/**
 * lib/notifications.ts — Web stub (no-op)
 * expo-notifications tidak mendukung browser/web runtime.
 * Platform-split: Metro akan pakai .native.ts untuk iOS/Android.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function scheduleDailyReminder(_hour = 20, _minute = 0): Promise<void> {
  // no-op on web
}

export async function onDailyReminderReceived(): Promise<void> {
  // no-op on web
}

export async function refreshDailyReminderSchedule(_hour = 20, _minute = 0): Promise<void> {
  // no-op on web
}

export async function cancelAllReminders(): Promise<void> {
  // no-op on web
}

export async function sendTestNotification(): Promise<void> {
  // no-op on web
}

export async function isReminderEnabled(): Promise<boolean> {
  return false;
}
