/**
 * lib/nativeGoogleAuth.ts — Web / Fallback stub
 * Native Google Sign-In menggunakan Google Play Services di Android.
 * Pada Web, autentikasi menggunakan browser redirect standard via Supabase.
 */

export const isNativeGoogleSignInAvailable = false;

export async function signInWithGoogleNative(): Promise<{ idToken: string } | null> {
  throw new Error('Native Google Sign-In is only available on native mobile platforms.');
}

export async function signOutGoogleNative(): Promise<void> {
  // No-op di web
}
