/**
 * Base URL of the API, from EXPO_PUBLIC_API_URL (set in mobile/.env.local, see .env.example).
 * Must be read as `process.env.EXPO_PUBLIC_API_URL` literally: Expo inlines it at build time.
 */
export function apiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy mobile/.env.example to mobile/.env.local and restart Expo.',
    );
  }
  return url;
}
