import * as SecureStore from 'expo-secure-store';

import { SECURE_STORE_OPTIONS } from '../../auth/tokenStore';

// "This device has seen the full guest hero" (design guest-home 3b, PM decision 2): kept on
// the device only, never sent to the server, never tied to an account. A missing or
// unreadable flag shows the full hero (safe default).
export const HERO_SEEN_KEY = 'sparkcircles.guest.heroSeen';

export async function readHeroSeen(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(HERO_SEEN_KEY, SECURE_STORE_OPTIONS)) === '1';
  } catch {
    return false;
  }
}

export async function markHeroSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(HERO_SEEN_KEY, '1', SECURE_STORE_OPTIONS);
  } catch {
    // The full hero shows again next time.
  }
}

/** Development only: forget the flag so the next visit shows the full hero again. */
export async function resetHeroSeen(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(HERO_SEEN_KEY, SECURE_STORE_OPTIONS);
  } catch {
    // Nothing to reset.
  }
}
