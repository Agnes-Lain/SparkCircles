import { onlineManager } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import i18n from '../i18n';
import { secureTokenStore, TOKEN_KEY } from '../auth/tokenStore';
import { apiError, mockAuth, offlineError, resetApiMock } from './apiMock';
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

  it('shows Welcome to a device without a token', async () => {
    const { app } = await openApp({ token: null });

    expect(await screen.findByText('Créer mon compte')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/welcome');
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('AC-3.4 skips Welcome when the app reopens with a valid token', async () => {
    mockAuth.me.mockResolvedValue(meFixture);

    const { app } = await openApp({ token: 'jwt' });

    expect(await screen.findByRole('header', { name: 'Accueil' })).toBeOnTheScreen();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(app.getPathname()).toBe('/');
  });

  it('AC-2.3 sends an unconfirmed account to Check your inbox only', async () => {
    mockAuth.me.mockResolvedValue(unconfirmedMe);

    const { app } = await openApp({ token: 'jwt', url: '/events' });

    expect(await screen.findByRole('header', { name: 'Consulte ta boîte mail' })).toBeOnTheScreen();
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

    expect(await screen.findByRole('header', { name: 'Accueil' })).toBeOnTheScreen();
  });

  it('AC-2.1 opens the confirmation link logged in on Home, with the checkmark and the toast', async () => {
    mockAuth.confirmEmail.mockResolvedValue({ token: 'new-jwt', user: meFixture });

    const { app } = await openApp({ token: null, url: '/confirm-email?token=abc123' });

    expect(await screen.findByRole('header', { name: 'Accueil' })).toBeOnTheScreen();
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

  it('AC-2.2 sends an expired confirmation link to Link expired', async () => {
    mockAuth.confirmEmail.mockRejectedValue(apiError(422, 'invalid_or_expired_token'));

    const { app } = await openApp({ token: null, url: '/confirm-email?token=old' });

    expect(await screen.findByRole('header', { name: 'Ce lien a expiré' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/link-expired');
  });

  it('AC-3.5 logs out from My account (avatar on Home): Welcome and "You\'re logged out"', async () => {
    mockAuth.me.mockResolvedValue(meFixture);
    const { app } = await openApp({ token: 'jwt' });
    await screen.findByRole('header', { name: 'Accueil' });
    expect(screen.queryByTestId('dev-log-out')).toBeNull();

    await fireEvent.press(await screen.findByRole('button', { name: 'Mon compte' }));
    expect(await screen.findByRole('header', { name: 'Mon compte' })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/account');
    await fireEvent.press(screen.getByRole('button', { name: 'Me déconnecter' }));

    expect(await screen.findByText('Créer mon compte')).toBeOnTheScreen();
    expect(mockAuth.logOut).toHaveBeenCalled();
    expect(screen.getByText('Déconnexion effectuée')).toBeOnTheScreen();
    await expect(SecureStore.getItemAsync(TOKEN_KEY)).resolves.toBeNull();
  });

  it('M-18 logs out on the device even when the API cannot be reached', async () => {
    mockAuth.me.mockResolvedValue(meFixture);
    mockAuth.logOut.mockRejectedValue(offlineError());
    await openApp({ token: 'jwt', url: '/account' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Me déconnecter' }));

    expect(await screen.findByText('Créer mon compte')).toBeOnTheScreen();
    await expect(SecureStore.getItemAsync(TOKEN_KEY)).resolves.toBeNull();
  });

  it('sends unknown paths (e.g. a later-PR email link) back through the gate', async () => {
    await openApp({ token: null, url: '/verification-status' });

    expect(await screen.findByText('Créer mon compte')).toBeOnTheScreen();
  });

  it('AC-12.2 the "your data is ready" link needs a logged-in phone', async () => {
    const { app } = await openApp({ token: null, url: '/my-data' });

    expect(await screen.findByText('Créer mon compte')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/welcome');
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
