// QA (mobile-auth): edge cases of the auth screens and the gate not covered by the
// developer's tests.
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { secureTokenStore } from '../../auth/tokenStore';
import i18n from '../../i18n';
import { LogInScreen } from '../../screens/auth/LogInScreen';
import { NewPasswordScreen } from '../../screens/auth/NewPasswordScreen';
import { SignUpScreen } from '../../screens/auth/SignUpScreen';
import { apiError, mockAuth, resetApiMock } from '../../test/apiMock';
import { meFixture } from '../../test/fixtures';
import { renderScreen, routeStub } from '../../test/renderScreen';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);
jest.mock('expo-device', () => ({ modelName: 'iPhone 15' }));

const APP_DIR = `${process.cwd()}/src/app`;
const PASSWORD = `pw-${Math.random().toString(36).slice(2, 12)}-qa`;

describe('QA auth flows', () => {
  beforeEach(async () => {
    await secureTokenStore.clearToken();
    resetApiMock();
    await i18n.changeLanguage('fr');
  });
  afterEach(() => jest.restoreAllMocks());

  // QA BUG-A03: the keyboard's "go" key calls submit() again while the first request is
  // pending (the button is disabled, the keyboard isn't).
  it.failing('BUG-A03 Log in: pressing "go" twice sends one request', async () => {
    mockAuth.logIn.mockReturnValue(new Promise(() => undefined));
    await renderScreen({ 'log-in': LogInScreen }, { url: '/log-in' });
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'claire@example.com');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), PASSWORD);
    await fireEvent(screen.getByLabelText('Mot de passe'), 'submitEditing');
    await fireEvent(screen.getByLabelText('Mot de passe'), 'submitEditing');

    expect(mockAuth.logIn).toHaveBeenCalledTimes(1);
  });

  it.failing('BUG-A03 New password: pressing "done" twice sends one request', async () => {
    mockAuth.resetPassword.mockReturnValue(new Promise(() => undefined));
    await renderScreen(
      { 'reset-password': NewPasswordScreen, 'link-expired': routeStub('link-expired') },
      { url: '/reset-password?token=abc' },
    );
    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), PASSWORD);
    await fireEvent(screen.getByLabelText('Nouveau mot de passe'), 'submitEditing');
    await fireEvent(screen.getByLabelText('Nouveau mot de passe'), 'submitEditing');

    expect(mockAuth.resetPassword).toHaveBeenCalledTimes(1);
  });

  // QA BUG-A04: the API emails "forgot-password" links (account locked, password changed,
  // registration attempt), but the gate only treats confirm-email, reset-password and
  // this-wasnt-me as email-link routes.
  it('BUG-A04 evidence: a forgot-password link on a logged-in phone ends on Home', async () => {
    mockAuth.me.mockResolvedValue(meFixture);
    await secureTokenStore.setToken('jwt');
    const app = renderRouter(APP_DIR, { initialUrl: '/forgot-password' });
    await app;

    await screen.findByRole('header', { name: 'Accueil' }, { timeout: 2000 });
    expect(app.getPathname()).toBe('/');
    expect(screen.queryByText('Réinitialise ton mot de passe')).toBeNull();
  });

  it('Sign up: the first field in error gets focus and its message is announced', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderScreen({ 'sign-up': SignUpScreen }, { url: '/sign-up' });
    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(announce).toHaveBeenCalledWith('Ajoute ton prénom.');
    expect(mockAuth.register).not.toHaveBeenCalled();
  });

  it('Sign up: an email already used gives the same Check your inbox (AC-1.3)', async () => {
    mockAuth.register.mockResolvedValue({ status: 'check_inbox' });
    const { app } = await renderScreen(
      { 'sign-up': SignUpScreen, 'check-inbox': routeStub('check-inbox') },
      { url: '/sign-up' },
    );
    await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Claire');
    await fireEvent.changeText(screen.getByLabelText('Nom'), 'Martin');
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'used@example.com');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), PASSWORD);
    await fireEvent.press(screen.getByRole('checkbox', { name: "J'ai 18 ans ou plus" }));
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: "J'accepte les conditions d'utilisation et la politique de confidentialité",
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByText('route:check-inbox')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/check-inbox');
    // Nothing about the email travels in the route (AC-10.6).
    expect(app.getPathnameWithParams()).not.toContain('used@example.com');
    expect(mockAuth.register).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'fr', marketing_opt_in: false }),
    );
  });

  it('a reset link removes its token from the route and sends it only in the body', async () => {
    mockAuth.resetPassword.mockResolvedValue({ token: 'device-jwt', user: meFixture });
    const { app, tokenStore } = await renderScreen(
      { 'reset-password': NewPasswordScreen, index: routeStub('home') },
      { url: '/reset-password?token=secret-link-token', gate: 'ready' },
    );
    await waitFor(() => expect(app.getPathnameWithParams()).not.toContain('secret-link-token'));
    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), PASSWORD);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enregistrer mon nouveau mot de passe' }),
    );

    await waitFor(() =>
      expect(mockAuth.resetPassword).toHaveBeenCalledWith(
        'secret-link-token',
        PASSWORD,
        'iPhone 15',
      ),
    );
    await waitFor(() => expect(tokenStore.setToken).toHaveBeenCalledWith('device-jwt'));
  });

  it('a 401 on Log in for a locked report account shows the lock message (423)', async () => {
    mockAuth.logIn.mockRejectedValue(apiError(423, 'account_locked'));
    await renderScreen({ 'log-in': LogInScreen }, { url: '/log-in' });
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'claire@example.com');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), PASSWORD);
    await fireEvent.press(screen.getByRole('button', { name: 'Me connecter' }));

    // Same copy for the 15-minute lock and the "This wasn't me" lock (design gap, see report).
    expect(await screen.findByText('Trop de tentatives')).toBeOnTheScreen();
  });
});
