/**
 * lib/nativeGoogleAuth.native.ts — Native Android/iOS Google Sign-In
 * Menggunakan @react-native-google-signin/google-signin untuk memunculkan
 * modal popup Google Play Services (tanpa membuka browser / domain supabase).
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '1006540967968-573opn9bqedh1fobol44c1irbeev2fuo.apps.googleusercontent.com';

let isConfigured = false;

function ensureConfigured() {
  if (!isConfigured) {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: ['email', 'profile'],
      offlineAccess: true,
    });
    isConfigured = true;
  }
}

export const isNativeGoogleSignInAvailable = true;

/**
 * Melakukan sign-in via bottom sheet Google Play Services asli Android.
 * Mengembalikan idToken yang dapat langsung diverifikasi oleh Supabase.
 * Mengembalikan null jika pengguna membatalkan (menutup popup).
 */
export async function signInWithGoogleNative(): Promise<{ idToken: string } | null> {
  ensureConfigured();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    if (response.type === 'success') {
      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error('Google Sign-In tidak mengembalikan ID token.');
      }
      return { idToken };
    }

    // Pengguna membatalkan prompt
    return null;
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      // Pengguna membatalkan dialog secara sengaja
      return null;
    }
    if (error.code === statusCodes.IN_PROGRESS) {
      // Operasi sedang berlangsung
      return null;
    }
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services tidak tersedia atau perlu diperbarui.');
    }
    throw error;
  }
}

/**
 * Sign-out dari sesi Google Play Services di perangkat.
 */
export async function signOutGoogleNative(): Promise<void> {
  try {
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch {
    // Abaikan error saat sign out lokal
  }
}
