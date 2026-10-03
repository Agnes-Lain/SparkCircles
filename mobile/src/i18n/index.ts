import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import fr from './fr.json';

export const SUPPORTED_LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export const resources = { fr: { translation: fr }, en: { translation: en } } as const;

/** French by default; English when the phone is set to English (proposal M-21). */
export function resolveLocale(languageCode: string | null | undefined): Locale {
  return languageCode?.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LOCALE;
}

export function deviceLocale(): Locale {
  return resolveLocale(getLocales()[0]?.languageCode);
}

/** The language of the app right now, sent to the API as Accept-Language. */
export function currentLocale(): Locale {
  return resolveLocale(i18n.language);
}

if (!i18n.isInitialized) {
  // eslint-disable-next-line import/no-named-as-default-member -- i18next's documented instance API
  void i18n.use(initReactI18next).init({
    resources,
    lng: deviceLocale(),
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });
}

export default i18n;
