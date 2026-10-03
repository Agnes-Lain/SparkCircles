import * as SecureStore from 'expo-secure-store';

import i18n, { type Locale, resolveLocale } from './index';

// The language chosen before login (Welcome's "Français / English" link), remembered on the
// device. A tiny non-secret value kept in secure storage to avoid another package (M-21).
export const LOCALE_KEY = 'sparkcircles.locale';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** Applies the remembered language, if any. Never fails: the phone's language stays. */
export async function restoreLocale(): Promise<void> {
  try {
    const stored = await SecureStore.getItemAsync(LOCALE_KEY, OPTIONS);
    if (stored) await i18n.changeLanguage(resolveLocale(stored));
  } catch {
    // Keep the phone's language.
  }
}

/** Switches the app language and remembers it for the next start. */
export async function changeAppLanguage(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale);
  try {
    await SecureStore.setItemAsync(LOCALE_KEY, locale, OPTIONS);
  } catch {
    // The switch still applies until the app restarts.
  }
}
