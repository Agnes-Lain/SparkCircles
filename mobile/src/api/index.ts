import { emitUnauthorized } from '../auth/sessionEvents';
import { secureTokenStore } from '../auth/tokenStore';
import { currentLocale } from '../i18n';
import { createApiClient } from './client';
import { apiBaseUrl } from './config';

export { ApiError } from './errors';
export type * from './types';

let client: ReturnType<typeof createApiClient> | undefined;

/** The app's API client. Every API call goes through it (CLAUDE.md). */
export function api() {
  client ??= createApiClient({
    baseUrl: apiBaseUrl(),
    tokenStore: secureTokenStore,
    getLocale: currentLocale,
    onUnauthorized: emitUnauthorized,
  });
  return client;
}
