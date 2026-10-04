import type { ApiClient } from './client';
import type { Closure, DataExport, Me, ProfileParams, PublicProfile } from './types';

// The My account endpoints (docs/api/accounts-and-verification.md, sections 4, 5, 7 and 8).

type Client = Pick<ApiClient, 'request'>;

/** React Query keys of the My account screens. */
export const PUBLIC_PROFILE_KEY = ['me', 'public_profile'] as const;
export const DATA_EXPORT_KEY = ['data_export'] as const;

export function accountApi(client: Client) {
  return {
    /** §4 DELETE /sessions: every device, this one included (AC-3.6). */
    logOutEverywhere: () => client.request<void>('/sessions', { method: 'DELETE' }),

    /** §4 PUT /me/password: other devices are logged out (AC-4.4). */
    changePassword: (currentPassword: string, password: string) =>
      client.request<Me>('/me/password', {
        method: 'PUT',
        body: { current_password: currentPassword, password },
      }),

    /** §5 PATCH /me: a verified parent's name change resets the verification (AC-7.8). */
    updateProfile: (user: ProfileParams) =>
      client.request<Me>('/me', { method: 'PATCH', body: { user } }),

    /** §5 GET /me/public_profile: exactly what others see (AC-6.3). */
    publicProfile: (signal?: AbortSignal) =>
      client.request<PublicProfile>('/me/public_profile', { signal }),

    /** §5 PUT /me/marketing: applies at once (AC-5.4). */
    setMarketing: (optIn: boolean) =>
      client.request<Me>('/me/marketing', { method: 'PUT', body: { marketing_opt_in: optIn } }),

    /** §5 POST /me/email_change: same answer whether or not the address is taken (AC-13.5). */
    requestEmailChange: (email: string, currentPassword: string) =>
      client.request<{ status: 'check_new_inbox' }>('/me/email_change', {
        method: 'POST',
        body: { email, current_password: currentPassword },
      }),

    /** §7 POST /closure (AC-11.1, 11.2): every device is logged out. */
    closeAccount: (currentPassword: string) =>
      client.request<{ closure: Closure }>('/closure', {
        method: 'POST',
        body: { current_password: currentPassword },
      }),

    /** §8 GET /data_export */
    dataExport: (signal?: AbortSignal) =>
      client.request<{ data_export: DataExport | null }>('/data_export', { signal }),

    /** §8 POST /data_export (AC-12.1, 12.3) */
    requestDataExport: () =>
      client.request<{ data_export: DataExport }>('/data_export', { method: 'POST' }),

    /** §8 GET /data_export/download: the JSON file, owner only, logged in (AC-12.2). */
    downloadDataExport: () => client.request<unknown>('/data_export/download'),
  };
}

export type AccountApi = ReturnType<typeof accountApi>;
