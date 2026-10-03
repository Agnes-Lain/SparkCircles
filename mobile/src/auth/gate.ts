import type { Href } from 'expo-router';

import type { ApiError } from '../api/errors';
import type { Me } from '../api/types';
import type { SessionStatus, SignOutReason } from './SessionProvider';

/**
 * Where the auth gate lets this device go (proposal M-9, contract §1 "Account gates").
 * Checked in the API's order: email not confirmed, closure pending, new terms.
 */
export type GateState =
  | 'loading' // reading the token or GET /me (the splash stays up)
  | 'signedOut' // S1 Welcome and the other auth screens
  | 'unconfirmed' // S3 Check your inbox only (AC-2.3)
  | 'closing' // S10 Closure in progress (AC-11.3)
  | 'terms' // S9 Terms updated (AC-5.5)
  | 'unreachable' // a token, but GET /me couldn't reach the API
  | 'ready'; // the tabs

export function gateState(
  status: SessionStatus,
  me: Me | undefined,
  meError: ApiError | null,
): GateState {
  if (status === 'loading') return 'loading';
  if (status === 'signedOut') return 'signedOut';
  if (me) {
    if (!me.email_confirmed) return 'unconfirmed';
    if (me.closure) return 'closing';
    if (me.terms_acceptance_required) return 'terms';
    return 'ready';
  }
  return meError ? 'unreachable' : 'loading';
}

/** Routes opened from email links: reachable whatever the session (M-19). */
export const LINK_ROUTES = ['confirm-email', 'reset-password', 'this-wasnt-me', 'link-expired'];

const ALLOWED: Record<Exclude<GateState, 'loading'>, string[]> = {
  signedOut: ['welcome', 'sign-up', 'log-in', 'forgot-password', 'link-sent', 'check-inbox'],
  unconfirmed: ['check-inbox'],
  closing: ['account-closing'],
  terms: ['terms-updated'],
  unreachable: ['unreachable'],
  ready: ['(tabs)'],
};

/** The route name the gate reasons about: the tab group, or the screen's own name. */
export function routeName(segments: readonly string[]): string {
  const [first, second] = segments;
  if (first === '(tabs)') return '(tabs)';
  if (first === '(auth)') return second ?? 'welcome';
  return first ?? '(tabs)';
}

export function isAllowed(state: GateState, route: string): boolean {
  if (state === 'loading') return false;
  return LINK_ROUTES.includes(route) || ALLOWED[state].includes(route);
}

/** Where to send a device whose current route isn't allowed. */
export function homeFor(state: Exclude<GateState, 'loading'>, reason: SignOutReason): Href {
  switch (state) {
    case 'signedOut':
      // Logged out by the server (token refused): straight to Log in (M-18).
      return reason === 'unauthorized' ? '/log-in' : '/welcome';
    case 'unconfirmed':
      return '/check-inbox';
    case 'closing':
      return '/account-closing';
    case 'terms':
      return '/terms-updated';
    case 'unreachable':
      return '/unreachable';
    case 'ready':
      return '/';
  }
}
