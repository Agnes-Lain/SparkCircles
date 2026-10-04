import type { ApiClient } from './client';
import type {
  EmailConfirmationResponse,
  Legal,
  Me,
  RegistrationParams,
  SessionResponse,
} from './types';

// The account endpoints used by the auth screens (docs/api/accounts-and-verification.md,
// sections 3 to 7). One-time tokens from email links always travel in the body (§1).

type Client = Pick<ApiClient, 'request'>;

/** React Query key of `GET /legal` (terms and privacy policy URLs and versions). */
export const LEGAL_KEY = ['legal'] as const;

export function authApi(client: Client) {
  return {
    /** §2 GET /me */
    me: (signal?: AbortSignal) => client.request<Me>('/me', { signal }),

    /** §3 POST /registrations: always { status: 'check_inbox' } on success (AC-1.3). */
    register: (user: RegistrationParams) =>
      client.request<{ status: 'check_inbox' }>('/registrations', {
        method: 'POST',
        auth: false,
        body: { user },
      }),

    /** §3 POST /email_confirmations. Sends the token if this device has one (email change). */
    confirmEmail: (token: string, deviceName: string | null) =>
      client.request<EmailConfirmationResponse>('/email_confirmations', {
        method: 'POST',
        body: { token, device_name: deviceName },
      }),

    /** §3 POST /email_confirmations/resend: the email is ignored when authenticated. */
    resendConfirmation: (email?: string) =>
      client.request<{ status: 'check_inbox' }>('/email_confirmations/resend', {
        method: 'POST',
        body: email ? { email } : {},
      }),

    /** §4 POST /sessions */
    logIn: (email: string, password: string, deviceName: string | null) =>
      client.request<SessionResponse>('/sessions', {
        method: 'POST',
        auth: false,
        body: { email, password, device_name: deviceName },
      }),

    /** §4 DELETE /sessions/current: this device only (AC-3.5). */
    logOut: () => client.request<void>('/sessions/current', { method: 'DELETE' }),

    /** §4 POST /password_resets: always the same answer (AC-4.1). */
    requestPasswordReset: (email: string) =>
      client.request<{ status: 'link_sent_if_account_exists' }>('/password_resets', {
        method: 'POST',
        auth: false,
        body: { email },
      }),

    /** §4 PUT /password_resets (AC-4.2, 4.3) */
    resetPassword: (token: string, password: string, deviceName: string | null) =>
      client.request<SessionResponse>('/password_resets', {
        method: 'PUT',
        auth: false,
        body: { token, password, device_name: deviceName },
      }),

    /** §5 POST /email_change_reports: "This wasn't me" (AC-13.8) */
    reportEmailChange: (token: string) =>
      client.request<{ status: 'account_secured' | 'already_reported' }>('/email_change_reports', {
        method: 'POST',
        auth: false,
        body: { token },
      }),

    /** §5 GET /legal (auth optional) */
    legal: (signal?: AbortSignal) => client.request<Legal>('/legal', { signal }),

    /** §5 POST /me/terms_acceptance (AC-5.5) */
    acceptTerms: (termsVersion: string, privacyVersion: string) =>
      client.request<Me>('/me/terms_acceptance', {
        method: 'POST',
        body: { terms_version: termsVersion, privacy_version: privacyVersion },
      }),

    /** §7 DELETE /closure: keep the account during the grace period (AC-11.3) */
    cancelClosure: () => client.request<Me>('/closure', { method: 'DELETE' }),
  };
}

export type AuthApi = ReturnType<typeof authApi>;
