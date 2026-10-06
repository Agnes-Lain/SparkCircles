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

/**
 * Routes opened from email links: reachable whatever the session (M-19). Security emails
 * (account locked, password changed, someone tried to register) link to Forgot password,
 * which therefore opens on a logged-in phone too, with its Link sent screen (QA BUG-A04).
 */
export const LINK_ROUTES = [
  'confirm-email',
  'reset-password',
  'this-wasnt-me',
  'link-expired',
  'forgot-password',
  'link-sent',
];

/**
 * App links of the event emails (`Dev::OpenAppController::PATHS` in the API): `events`
 * (Sorties, and `events/<uuid>` the detail), `my-events` (Mes sorties) and `verification`
 * (V0 or V5). Members only: unlike LINK_ROUTES they keep the logged-out gate, because guest
 * browsing (US-15) comes in its own release. A logged-out phone lands on Welcome.
 */
export const EVENT_LINK_ROUTES = ['events', 'my-events', 'verification'];

/**
 * A8 Account closed: shown while the closed account's token stops working, and kept after the
 * device is signed out, until "OK".
 */
const ACCOUNT_CLOSED = 'account-closed';

const ALLOWED: Record<Exclude<GateState, 'loading'>, string[]> = {
  signedOut: [
    'welcome',
    'sign-up',
    'log-in',
    'forgot-password',
    'link-sent',
    'check-inbox',
    ACCOUNT_CLOSED,
  ],
  unconfirmed: ['check-inbox'],
  closing: ['account-closing'],
  // S9 "I don't accept" leads to Close my account (A7).
  terms: ['terms-updated', 'close-account', ACCOUNT_CLOSED],
  unreachable: ['unreachable'],
  // The tabs, My account (A1–A8; `my-data` is also the "your data is ready" email link),
  // identity verification (V0–V5) and Events (detail, create, edit), with the app links of the
  // event emails: `events`, `events/<id>`, `my-events` and `verification`.
  ready: [
    '(tabs)',
    'account',
    'my-data',
    'close-account',
    ACCOUNT_CLOSED,
    'verify',
    ...EVENT_LINK_ROUTES,
  ],
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
