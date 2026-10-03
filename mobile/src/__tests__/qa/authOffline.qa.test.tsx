// QA (mobile-auth): what the person sees when the phone is offline (NetInfo says "no
// connection"), with the app's real query client (src/api/queryClient.ts).
// QA BUG-A01 (fixed): queries and mutations use networkMode 'always', so while NetInfo says
// "offline" they run and fail with network_error instead of being paused forever.
import { onlineManager } from '@tanstack/react-query';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { secureTokenStore } from '../../auth/tokenStore';
import i18n from '../../i18n';
import { mockAuth, offlineError, resetApiMock } from '../../test/apiMock';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

const APP_DIR = `${process.cwd()}/src/app`;

describe('QA offline (phone without connection)', () => {
  beforeEach(async () => {
    await secureTokenStore.clearToken();
    resetApiMock();
    await i18n.changeLanguage('fr');
    onlineManager.setOnline(false);
  });
  afterEach(() => onlineManager.setOnline(true));

  it('BUG-A01 Log in offline shows the designed "couldn\'t reach" notification', async () => {
    mockAuth.logIn.mockRejectedValue(offlineError());
    await renderRouter(APP_DIR, { initialUrl: '/log-in' });
    await screen.findByRole('header', { name: 'Connexion' });

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'claire@example.com');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'a-long-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Me connecter' }));

    expect(
      await screen.findByText('Impossible de joindre SparkCircles', {}, { timeout: 3000 }),
    ).toBeOnTheScreen();
  });

  it('BUG-A01 app start offline with a token shows the error screen (not an endless splash)', async () => {
    mockAuth.me.mockRejectedValue(offlineError());
    await secureTokenStore.setToken('jwt');
    await renderRouter(APP_DIR, { initialUrl: '/' });

    expect(
      await screen.findByText('Impossible de joindre SparkCircles', {}, { timeout: 3000 }),
    ).toBeOnTheScreen();
  });
});

describe('QA offline: requests are never paused (BUG-A01)', () => {
  beforeEach(async () => {
    await secureTokenStore.clearToken();
    resetApiMock();
    await i18n.changeLanguage('fr');
    onlineManager.setOnline(false);
  });
  afterEach(() => onlineManager.setOnline(true));

  it('Log in is sent at once, even while NetInfo says the phone is offline', async () => {
    mockAuth.logIn.mockRejectedValue(offlineError());
    await renderRouter(APP_DIR, { initialUrl: '/log-in' });
    await screen.findByRole('header', { name: 'Connexion' });
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'claire@example.com');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'a-long-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Me connecter' }));

    await waitFor(() => expect(mockAuth.logIn).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
  });
});
