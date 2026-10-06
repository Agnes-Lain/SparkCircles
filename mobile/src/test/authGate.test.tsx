import { onlineManager } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import i18n from '../i18n';
import { secureTokenStore, TOKEN_KEY } from '../auth/tokenStore';
import { apiError, mockAuth, mockEvents, offlineError, resetApiMock } from './apiMock';
import { saveReturnTo } from '../auth/returnTo';
import { eventFixture, eventOptionsFixture, eventPage, guestEvent } from './eventFixtures';
import { closingMe, meFixture, termsMe, unconfirmedMe } from './fixtures';

afterEach(() => onlineManager.setOnline(true));

jest.mock('../api', () => jest.requireActual('./apiMock').apiModule);

const secureStore = SecureStore as typeof SecureStore & { __reset: () => void };
// The real route files (Jest runs from mobile/).
const APP_DIR = `${process.cwd()}/src/app`;

// renderRouter's result carries getPathname(); awaiting it would drop them, so it's wrapped.
async function openApp({ token, url = '/' }: { token: string | null; url?: string }) {
  if (token) await secureTokenStore.setToken(token);
  const app = renderRouter(APP_DIR, { initialUrl: url });
  await app;
  return { app };
}

describe('auth gate (M-9)', () => {
  beforeEach(async () => {
    await secureTokenStore.clearToken(); // also empties the store's memory cache
    secureStore.__reset();
    resetApiMock();
    await i18n.changeLanguage('fr');
  });

  it('AC-15.1 opens Sorties in guest mode on a device without a token (no Welcome first)', async () => {
    const { app } = await openApp({ token: null });

    expect(
      await screen.findByRole('header', {
        name: 'Les sorties en famille, sans la charge mentale.',
      }),
    ).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/');
    expect(screen.getByRole('tab', { name: 'Sorties' })).toBeSelected();
    expect(mockAuth.me).not.toHaveBeenCalled();
  });

  it('AC-3.4 skips Welcome when the app reopens with a valid token', async () => {
    mockAuth.me.mockResolvedValue(meFixture);

    const { app } = await openApp({ token: 'jwt' });

    // v1.7: the app opens on Sorties (Events).
    expect(await screen.findByRole('header', { name: 'Sorties' })).toBeOnTheScreen();
    // The tab bar (Sorties also has its own "À découvrir / Mes sorties" segments).
    const tabBar = screen.getByTestId('tab-bar');
    expect(within(tabBar).getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: 'Sorties' })).toBeSelected();
    expect(app.getPathname()).toBe('/');
  });

  it('AC-2.3 sends an unconfirmed account to Check your inbox only', async () => {
    mockAuth.me.mockResolvedValue(unconfirmedMe);

    const { app } = await openApp({ token: 'jwt', url: '/events' });

    expect(await screen.findByRole('header', { name: 'Consulte tes e-mails' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/check-inbox');
    expect(screen.getByText('c•••••@example.com')).toBeOnTheScreen();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('AC-11.3 sends an account in its grace period to Closure in progress', async () => {
    mockAuth.me.mockResolvedValue(closingMe);

    await openApp({ token: 'jwt' });

    expect(
      await screen.findByRole('header', { name: 'Ton compte est en cours de fermeture' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('12 nov. 2026')).toBeOnTheScreen();
  });

  it('AC-5.5 sends an account with new terms to Terms updated', async () => {
    mockAuth.me.mockResolvedValue(termsMe);
    mockAuth.legal.mockReturnValue(new Promise(() => undefined));

    const { app } = await openApp({ token: 'jwt' });

    expect(
      await screen.findByRole('header', { name: 'Nos conditions ont changé' }),
    ).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/terms-updated');
  });

  it('AC-3.4 sends the device to Log in when the API refuses the token', async () => {
    mockAuth.me.mockImplementation(async () => {
      // What the real client does on 401 unauthorized: clear the token, end the session.
      await secureTokenStore.clearToken();
      const { emitUnauthorized } = jest.requireActual('../auth/sessionEvents');
      emitUnauthorized();
      throw apiError(401, 'unauthorized');
    });

    const { app } = await openApp({ token: 'expired' });

    await waitFor(() => expect(app.getPathname()).toBe('/log-in'));
    expect(screen.getByRole('header', { name: 'Connexion' })).toBeOnTheScreen();
  });

  it('M-20 offline at start with a token: the error notification, then Try again', async () => {
    mockAuth.me.mockRejectedValueOnce(offlineError()).mockResolvedValue(meFixture);
    onlineManager.setOnline(false); // NetInfo: no connection (QA BUG-A01)

    await openApp({ token: 'jwt' });

    expect(await screen.findByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
    expect(screen.queryByText('Créer mon compte')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('header', { name: 'Sorties' })).toBeOnTheScreen();
  });

  it('AC-2.1 opens the confirmation link logged in on My space, with the checkmark and the toast', async () => {
    mockAuth.confirmEmail.mockResolvedValue({ token: 'new-jwt', user: meFixture });

    const { app } = await openApp({ token: null, url: '/confirm-email?token=abc123' });

    expect(await screen.findByRole('header', { name: 'Mon espace' })).toBeOnTheScreen();
    expect(mockAuth.confirmEmail).toHaveBeenCalledWith('abc123', expect.anything());
    expect(screen.getByText('E-mail confirmé. Bienvenue sur SparkCircles !')).toBeOnTheScreen();
    // Decorative (hidden from screen readers): the toast says what happened.
    expect(
      await screen.findByTestId('success-checkmark', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    await expect(SecureStore.getItemAsync(TOKEN_KEY)).resolves.toBe('new-jwt');
    // The one-time token doesn't stay in the route (M-19).
    expect(app.getPathnameWithParams()).not.toContain('abc123');
  });

  it('AC-15.7 after the email confirmation, a guest is back on the event, the join ready not done', async () => {
    await saveReturnTo({ event: { id: eventFixture.id, then: 'join' } });
    mockAuth.confirmEmail.mockResolvedValue({ token: 'new-jwt', user: meFixture });
    mockAuth.me.mockResolvedValue(meFixture);
    mockEvents.get.mockResolvedValue({ event: eventFixture });

    const { app } = await openApp({ token: null, url: '/confirm-email?token=abc123' });

    expect(await screen.findByText('Combien de places ?')).toBeOnTheScreen();
    expect(app.getPathname()).toBe(`/events/${eventFixture.id}`);
    expect(mockEvents.join).not.toHaveBeenCalled();
  });

  it('AC-15.7 after logging in, a guest is back on the search they were on', async () => {
    await saveReturnTo({ filters: null });
    mockAuth.me.mockResolvedValue(meFixture);
    mockEvents.options.mockResolvedValue(eventOptionsFixture);
    mockEvents.search.mockResolvedValue(eventPage([eventFixture]));
    // A token arrives while Log in is open: the gate becomes ready.
    const { app } = await openApp({ token: 'jwt', url: '/log-in' });

    expect(await screen.findByRole('header', { name: 'Sorties' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/');
  });

  it('AC-2.2 sends an expired confirmation link to Link expired', async () => {
    mockAuth.confirmEmail.mockRejectedValue(apiError(422, 'invalid_or_expired_token'));

    const { app } = await openApp({ token: null, url: '/confirm-email?token=old' });

    expect(await screen.findByRole('header', { name: 'Ce lien a expiré' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/link-expired');
  });

  it('AC-3.5 logs out from My account (avatar on My space): Welcome and "You\'re logged out"', async () => {
    mockAuth.me.mockResolvedValue(meFixture);
    const { app } = await openApp({ token: 'jwt', url: '/my-space' });
    await screen.findByRole('header', { name: 'Mon espace' });
    expect(screen.queryByTestId('dev-log-out')).toBeNull();

    await fireEvent.press(await screen.findByRole('button', { name: 'Mon compte' }));
    expect(await screen.findByRole('header', { name: 'Mon compte' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/account');
    await fireEvent.press(screen.getByRole('button', { name: 'Me déconnecter' }));

    expect(
      await screen.findByRole('header', {
        name: 'Les sorties en famille, sans la charge mentale.',
      }),
    ).toBeOnTheScreen();
    expect(mockAuth.logOut).toHaveBeenCalled();
    expect(screen.getByText('Déconnexion effectuée')).toBeOnTheScreen();
    await expect(SecureStore.getItemAsync(TOKEN_KEY)).resolves.toBeNull();
  });

  it('M-18 logs out on the device even when the API cannot be reached', async () => {
    mockAuth.me.mockResolvedValue(meFixture);
    mockAuth.logOut.mockRejectedValue(offlineError());
    await openApp({ token: 'jwt', url: '/account' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Me déconnecter' }));

    expect(
      await screen.findByRole('header', {
        name: 'Les sorties en famille, sans la charge mentale.',
      }),
    ).toBeOnTheScreen();
    await expect(SecureStore.getItemAsync(TOKEN_KEY)).resolves.toBeNull();
  });

  it('sends unknown paths (e.g. a later-PR email link) back through the gate', async () => {
    await openApp({ token: null, url: '/verification-status' });

    expect(
      await screen.findByRole('header', {
        name: 'Les sorties en famille, sans la charge mentale.',
      }),
    ).toBeOnTheScreen();
  });

  it('AC-15.1b a logged-out phone opens an event link (events/<uuid>) on the guest view', async () => {
    mockEvents.get.mockResolvedValue({ event: guestEvent });
    const { app } = await openApp({ token: null, url: `/events/${guestEvent.id}` });

    expect(await screen.findByText('Organisée par un parent vérifié')).toBeOnTheScreen();
    expect(app.getPathname()).toBe(`/events/${guestEvent.id}`);
  });

  it('AC-15.1b a logged-out phone opens the `events` link on Sorties as a guest; `my-events` too', async () => {
    mockEvents.options.mockResolvedValue(eventOptionsFixture);
    mockEvents.search.mockResolvedValue(eventPage([guestEvent]));
    const { app } = await openApp({ token: null, url: '/events' });
    expect(await screen.findByText('Goûter et jeux au parc')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/');

    const second = await openApp({ token: null, url: '/my-events' });
    await waitFor(() => expect(second.app.getPathname()).toBe('/'));
  });

  it('AC-12.2 the "your data is ready" link needs a logged-in phone', async () => {
    const { app } = await openApp({ token: null, url: '/my-data' });

    expect(await screen.findAllByText('Créer mon compte')).not.toHaveLength(0);
    expect(app.getPathname()).toBe('/');
  });

  it('AC-5.5 S9 "I don\'t accept" opens Close my account (A7)', async () => {
    mockAuth.me.mockResolvedValue(termsMe);
    mockAuth.legal.mockReturnValue(new Promise(() => undefined));
    const { app } = await openApp({ token: 'jwt' });

    await fireEvent.press(await screen.findByRole('button', { name: "Je n'accepte pas" }));

    expect(await screen.findByRole('header', { name: 'Ferme ton compte' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/close-account');
  });
});
