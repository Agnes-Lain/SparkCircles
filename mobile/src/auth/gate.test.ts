import { closingMe, meFixture, termsMe, unconfirmedMe } from '../test/fixtures';
import { ApiError } from '../api/errors';
import { EVENT_LINK_ROUTES, gateState, homeFor, isAllowed, LINK_ROUTES, routeName } from './gate';
import { maskEmail } from './pendingEmail';
import { formatDate } from '../i18n/format';

describe('auth gate rules (M-9, contract §1 "Account gates")', () => {
  it('waits while the token or the account is loading', () => {
    expect(gateState('loading', undefined, null)).toBe('loading');
    expect(gateState('signedIn', undefined, null)).toBe('loading');
  });

  it('AC-2.3 AC-11.3 AC-5.5 follows the API order: unconfirmed, closing, new terms', () => {
    expect(gateState('signedIn', { ...unconfirmedMe, closure: closingMe.closure }, null)).toBe(
      'unconfirmed',
    );
    expect(gateState('signedIn', { ...closingMe, terms_acceptance_required: true }, null)).toBe(
      'closing',
    );
    expect(gateState('signedIn', termsMe, null)).toBe('terms');
    expect(gateState('signedIn', meFixture, null)).toBe('ready');
  });

  it('AC-3.4 a device with a token never falls back to Welcome because it is offline', () => {
    const offline = new ApiError(0, 'network_error', 'offline');
    expect(gateState('signedIn', undefined, offline)).toBe('unreachable');
    expect(gateState('signedIn', meFixture, offline)).toBe('ready'); // last known account
  });

  it('keeps every email-link route reachable, whatever the state', () => {
    (['signedOut', 'unconfirmed', 'closing', 'terms', 'ready', 'unreachable'] as const).forEach(
      (state) => LINK_ROUTES.forEach((route) => expect(isAllowed(state, route)).toBe(true)),
    );
  });

  it('AC-2.3 an unconfirmed account sees only Check your inbox', () => {
    expect(isAllowed('unconfirmed', 'check-inbox')).toBe(true);
    expect(isAllowed('unconfirmed', '(tabs)')).toBe(false);
    expect(isAllowed('ready', 'welcome')).toBe(false);
  });

  it('AC-7.2 only a logged-in, ready account reaches identity verification (V0–V5)', () => {
    expect(isAllowed('ready', routeName(['verify', 'review']))).toBe(true);
    expect(isAllowed('unconfirmed', 'verify')).toBe(false);
    expect(isAllowed('signedOut', 'verify')).toBe(false);
  });

  it('AC-1.4 opens the event email links (events, events/<id>, my-events, verification) for members only', () => {
    expect(EVENT_LINK_ROUTES).toEqual(['events', 'my-events', 'verification']);
    expect(isAllowed('ready', routeName(['events', '[id]']))).toBe(true);
    expect(isAllowed('ready', routeName(['events', 'new']))).toBe(true);
    expect(isAllowed('ready', 'my-events')).toBe(true);
    expect(isAllowed('ready', 'verification')).toBe(true);
    expect(isAllowed('ready', routeName(['events', '[id]', 'edit']))).toBe(true);
  });

  it('AC-15.1 AC-15.1b a logged-out phone browses as a guest: the tabs and the event links', () => {
    expect(isAllowed('signedOut', '(tabs)')).toBe(true);
    expect(isAllowed('signedOut', routeName(['events']))).toBe(true);
    expect(isAllowed('signedOut', routeName(['events', '[id]']))).toBe(true);
    // Account links and the host's form still need an account.
    expect(isAllowed('signedOut', 'my-events')).toBe(false);
    expect(isAllowed('signedOut', 'verification')).toBe(false);
    expect(isAllowed('signedOut', routeName(['events', 'new']))).toBe(false);
    expect(isAllowed('signedOut', routeName(['events', '[id]', 'edit']))).toBe(false);
    expect(isAllowed('signedOut', 'account')).toBe(false);
  });

  it('names routes by their screen, the tabs as one group', () => {
    expect(routeName(['(tabs)', 'events'])).toBe('(tabs)');
    expect(routeName(['(auth)', 'log-in'])).toBe('log-in');
    expect(routeName(['confirm-email'])).toBe('confirm-email');
    expect(routeName([])).toBe('(tabs)');
  });

  it('M-18 AC-15.1 a refused token leads to Log in, a chosen logout to Sorties as a guest', () => {
    expect(homeFor('signedOut', 'unauthorized')).toBe('/log-in');
    expect(homeFor('signedOut', 'logout')).toBe('/');
    expect(homeFor('ready', null)).toBe('/');
  });
});

describe('copy helpers', () => {
  it('masks the email like the design (c•••••@gmail.com)', () => {
    expect(maskEmail('claire@gmail.com')).toBe('c•••••@gmail.com');
    expect(maskEmail('a@b.fr')).toBe('a•••••@b.fr');
  });

  it('writes dates as in the design, without shifting the day', () => {
    expect(formatDate('2026-11-12', 'en')).toBe('12 Nov 2026');
    expect(formatDate('2026-11-12', 'fr')).toBe('12 nov. 2026');
    expect(formatDate('2026-01-01', 'fr')).toBe('1 janv. 2026');
  });
});
