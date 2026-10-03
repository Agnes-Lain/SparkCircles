import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import i18n from '../../i18n';
import { ME_KEY } from '../../auth/useMe';
import { ApiError } from '../../api/errors';
import { apiError, mockAuth, offlineError, resetApiMock } from '../../test/apiMock';
import { meFixture } from '../../test/fixtures';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { ConfirmEmailScreen } from './ConfirmEmailScreen';
import { LinkExpiredScreen } from './LinkExpiredScreen';
import { NewPasswordScreen } from './NewPasswordScreen';
import { ReportEmailChangeScreen } from './ReportEmailChangeScreen';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);
jest.mock('expo-device', () => ({ modelName: 'iPhone 15' }));

const PASSWORD = `pw-${Math.random().toString(36).slice(2, 12)}-test`;

const ROUTES = {
  'reset-password': NewPasswordScreen,
  'confirm-email': ConfirmEmailScreen,
  'this-wasnt-me': ReportEmailChangeScreen,
  'link-expired': LinkExpiredScreen,
  'forgot-password': routeStub('forgot-password'),
  'check-inbox': routeStub('check-inbox'),
  'log-in': routeStub('log-in'),
  welcome: routeStub('welcome'),
  index: routeStub('home'),
};

describe('S8 New password (reset link)', () => {
  beforeEach(async () => {
    resetApiMock();
    await i18n.changeLanguage('fr');
  });

  it('AC-4.2 sets the new password, logs this device in and says so', async () => {
    mockAuth.resetPassword.mockResolvedValue({ token: 'jwt-2', user: meFixture });
    const { app, tokenStore, queryClient } = await renderScreen(ROUTES, {
      url: '/reset-password?token=reset-123',
      gate: 'ready',
    });

    expect(
      screen.getByRole('header', { name: 'Choisis un nouveau mot de passe' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Tes autres appareils seront déconnectés.')).toBeOnTheScreen();
    // The token left the route as soon as it was read (M-19).
    await waitFor(() => expect(app.getPathnameWithParams()).not.toContain('reset-123'));

    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), PASSWORD);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enregistrer mon nouveau mot de passe' }),
    );

    expect(await screen.findByText('Mot de passe modifié')).toBeOnTheScreen();
    expect(mockAuth.resetPassword).toHaveBeenCalledWith('reset-123', PASSWORD, 'iPhone 15');
    expect(tokenStore.value).toBe('jwt-2');
    expect(queryClient.getQueryData(ME_KEY)).toEqual(meFixture);
    expect(await screen.findByText('route:home')).toBeOnTheScreen();
  });

  it('AC-4.3 sends an expired or used reset link to Link expired, then Forgot password', async () => {
    mockAuth.resetPassword.mockRejectedValue(apiError(422, 'invalid_or_expired_token'));
    await renderScreen(ROUTES, { url: '/reset-password?token=old' });

    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), PASSWORD);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enregistrer mon nouveau mot de passe' }),
    );

    expect(await screen.findByRole('header', { name: 'Ce lien a expiré' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: "M'envoyer un nouveau lien" }));
    expect(await screen.findByText('route:forgot-password')).toBeOnTheScreen();
  });

  it('AC-1.4 keeps the password rules on the new password', async () => {
    mockAuth.resetPassword.mockRejectedValue(
      new ApiError(422, 'validation_failed', 'x', { password: ['too_common'] }),
    );
    await renderScreen(ROUTES, { url: '/reset-password?token=t' });

    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), 'motdepasse123');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enregistrer mon nouveau mot de passe' }),
    );

    expect(
      await screen.findByText(
        'Utilise au moins 10 caractères et évite les mots de passe courants comme « motdepasse123 ».',
      ),
    ).toBeOnTheScreen();
  });
});

describe('Confirmation link (/confirm-email)', () => {
  beforeEach(async () => {
    resetApiMock();
    await i18n.changeLanguage('fr');
  });

  it('AC-13.3 an email-change link says "Email changed" and keeps the session', async () => {
    const changed = { ...meFixture, email: 'new@example.com' };
    mockAuth.confirmEmail.mockResolvedValue({ token: null, user: changed });
    const { queryClient, tokenStore } = await renderScreen(ROUTES, {
      url: '/confirm-email?token=change-1',
      token: 'jwt',
      gate: 'ready',
    });

    expect(await screen.findByText('E-mail modifié')).toBeOnTheScreen();
    expect(queryClient.getQueryData(ME_KEY)).toEqual(changed);
    expect(tokenStore.value).toBe('jwt');
    expect(await screen.findByText('route:home')).toBeOnTheScreen();
  });

  it('AC-13.6 an address taken meanwhile: nothing changes, the API explains', async () => {
    mockAuth.confirmEmail.mockRejectedValue(
      apiError(
        409,
        'email_taken',
        "Cet e-mail ne peut pas être utilisé. Ton e-mail n'a pas changé.",
      ),
    );
    await renderScreen(ROUTES, {
      url: '/confirm-email?token=change-2',
      token: 'jwt',
      gate: 'ready',
    });

    expect(
      await screen.findByText("Cet e-mail ne peut pas être utilisé. Ton e-mail n'a pas changé."),
    ).toBeOnTheScreen();
  });

  it('shows a skeleton while confirming, and the error notification when offline', async () => {
    mockAuth.confirmEmail.mockRejectedValueOnce(offlineError()).mockResolvedValue({
      token: null,
      user: null,
    });
    await renderScreen(ROUTES, { url: '/confirm-email?token=c' });

    expect(screen.getByLabelText('Un instant…')).toBeOnTheScreen();
    expect(await screen.findByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(mockAuth.confirmEmail).toHaveBeenLastCalledWith('c', 'iPhone 15');
  });

  it('AC-2.2 an expired sign-up link sends a new one when the device knows the account', async () => {
    mockAuth.confirmEmail.mockRejectedValue(apiError(422, 'invalid_or_expired_token'));
    mockAuth.resendConfirmation.mockResolvedValue({ status: 'check_inbox' });
    await renderScreen(ROUTES, {
      url: '/confirm-email?token=old',
      token: 'jwt',
      gate: 'unconfirmed',
    });

    await fireEvent.press(await screen.findByRole('button', { name: "M'envoyer un nouveau lien" }));

    expect(await screen.findByText('route:check-inbox')).toBeOnTheScreen();
    expect(mockAuth.resendConfirmation).toHaveBeenCalledWith(undefined);
  });

  it('AC-2.2 an expired sign-up link on a device without a session leads to Log in', async () => {
    mockAuth.confirmEmail.mockRejectedValue(apiError(422, 'invalid_or_expired_token'));
    await renderScreen(ROUTES, { url: '/confirm-email?token=old' });

    await fireEvent.press(await screen.findByRole('button', { name: "M'envoyer un nouveau lien" }));

    expect(await screen.findByText('route:log-in')).toBeOnTheScreen();
  });
});

describe('"This wasn\'t me" link (/this-wasnt-me)', () => {
  beforeEach(async () => {
    resetApiMock();
    await i18n.changeLanguage('fr');
  });

  it('AC-13.8 secures the account without logging in and says what happens next', async () => {
    mockAuth.reportEmailChange.mockResolvedValue({ status: 'account_secured' });
    await renderScreen(ROUTES, { url: '/this-wasnt-me?token=report-1' });

    expect(
      await screen.findByRole('header', { name: 'Ton compte est sécurisé' }),
    ).toBeOnTheScreen();
    expect(mockAuth.reportEmailChange).toHaveBeenCalledWith('report-1');
  });

  it("AC-13.8 forgets this device's token too: every device is logged out", async () => {
    mockAuth.reportEmailChange.mockResolvedValue({ status: 'account_secured' });
    const { tokenStore } = await renderScreen(ROUTES, {
      url: '/this-wasnt-me?token=report-1',
      token: 'jwt',
      gate: 'ready',
    });

    await screen.findByRole('header', { name: 'Ton compte est sécurisé' });
    expect(tokenStore.value).toBeNull();
  });

  it('explains an expired report link (it cannot be sent again)', async () => {
    mockAuth.reportEmailChange.mockRejectedValue(apiError(422, 'invalid_or_expired_token'));
    await renderScreen(ROUTES, { url: '/this-wasnt-me?token=old' });

    expect(await screen.findByRole('header', { name: 'Ce lien a expiré' })).toBeOnTheScreen();
    expect(
      screen.getByText('Les liens fonctionnent pendant une durée limitée et une seule fois.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "M'envoyer un nouveau lien" })).toBeNull();
  });
});
