import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen } from 'expo-router/testing-library';

import i18n from '../../i18n';
import { emitUnauthorized } from '../../auth/sessionEvents';
import { ME_KEY } from '../../auth/useMe';
import { apiError, mockAuth, offlineError, resetApiMock } from '../../test/apiMock';
import { meFixture } from '../../test/fixtures';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { LinkSentScreen } from './LinkSentScreen';
import { LogInScreen } from './LogInScreen';

afterEach(() => onlineManager.setOnline(true));

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);
jest.mock('expo-device', () => ({ modelName: 'iPhone 15' }));

const PASSWORD = `pw-${Math.random().toString(36).slice(2, 12)}-test`;

function open(token: string | null = null) {
  return renderScreen(
    {
      'log-in': LogInScreen,
      'forgot-password': ForgotPasswordScreen,
      'link-sent': LinkSentScreen,
      'sign-up': routeStub('sign-up'),
    },
    { url: '/log-in', token },
  );
}

async function logIn(email = 'claire@example.com', password = PASSWORD) {
  await fireEvent.changeText(screen.getByLabelText('E-mail'), email);
  await fireEvent.changeText(screen.getByLabelText('Mot de passe'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Me connecter' }));
}

describe('S5 Log in', () => {
  beforeEach(async () => {
    resetApiMock();
    await i18n.changeLanguage('fr');
  });

  it('AC-3.1 logs the device in with the phone model as device name, and keeps the account', async () => {
    mockAuth.logIn.mockResolvedValue({ token: 'jwt-1', user: meFixture });
    const { tokenStore, queryClient } = await open();

    await logIn();

    await screen.findByRole('button', { name: 'Me connecter' });
    expect(mockAuth.logIn).toHaveBeenCalledWith('claire@example.com', PASSWORD, 'iPhone 15');
    expect(tokenStore.value).toBe('jwt-1');
    expect(queryClient.getQueryData(ME_KEY)).toEqual(meFixture);
  });

  it('AC-3.2 shows the same message for a wrong email or a wrong password', async () => {
    mockAuth.logIn.mockRejectedValue(apiError(401, 'invalid_credentials'));
    await open();

    await logIn('unknown@example.com');

    expect(
      await screen.findByText("L'e-mail et le mot de passe ne correspondent pas"),
    ).toBeOnTheScreen();
    expect(screen.getByText('Vérifie les deux et réessaie.')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toBeOnTheScreen();
  });

  it('AC-3.3 explains the 15-minute lock and offers to reset the password', async () => {
    mockAuth.logIn.mockRejectedValue(apiError(423, 'account_locked'));
    await open();

    await logIn();

    expect(await screen.findByText('Trop de tentatives')).toBeOnTheScreen();
    expect(
      screen.getByText('Réessaie dans 15 minutes ou réinitialise ton mot de passe.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Réinitialiser mon mot de passe' }));
    expect(
      await screen.findByRole('header', { name: 'Réinitialise ton mot de passe' }),
    ).toBeOnTheScreen();
  });

  it('D-8 a report lock (account_secured) says the team will help, with no reset action', async () => {
    mockAuth.logIn.mockRejectedValue(apiError(423, 'account_secured'));
    await open();

    await logIn();

    expect(await screen.findByText('Ton compte est bloqué pour ta sécurité')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Après le signalement du changement d'e-mail, notre équipe doit vérifier ton compte. Nous t'enverrons un lien par e-mail pour choisir un nouveau mot de passe. Attendre ne le débloquera pas.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('support-contact')).toHaveTextContent('[SUPPORT CONTACT]');
    expect(screen.queryByRole('button', { name: 'Réinitialiser mon mot de passe' })).toBeNull();
    expect(screen.queryByText('Trop de tentatives')).toBeNull();
  });

  it('D-6 rate limited: the error notification above the form, typed input kept', async () => {
    mockAuth.logIn.mockRejectedValue(apiError(429, 'rate_limited'));
    await open();

    await logIn();

    expect(await screen.findByText("Trop d'essais pour le moment")).toBeOnTheScreen();
    expect(screen.getByText('Attends quelques minutes, puis réessaie.')).toBeOnTheScreen();
    expect(screen.getByLabelText('E-mail')).toHaveProp('value', 'claire@example.com');
    expect(screen.getByLabelText('Mot de passe')).toHaveProp('value', PASSWORD);
    expect(screen.getByRole('button', { name: 'Me connecter' })).toBeEnabled();
  });

  it('D-3 after a server-side logout, a reminder says the session has ended', async () => {
    mockAuth.logIn.mockResolvedValue({ token: 'jwt-2', user: meFixture });
    await open('jwt-1');
    expect(screen.queryByTestId('session-ended')).toBeNull();

    await act(() => emitUnauthorized());

    expect(await screen.findByText('Ta session a pris fin')).toBeOnTheScreen();
    expect(screen.getByText('Reconnecte-toi pour continuer.')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();

    await logIn();
    await screen.findByRole('button', { name: 'Me connecter' });
    expect(screen.queryByText('Ta session a pris fin')).toBeNull();
  });

  it('D-3 shows the English reminder', async () => {
    await i18n.changeLanguage('en');
    await open('jwt-1');

    await act(() => emitUnauthorized());

    expect(await screen.findByText('Your session has ended')).toBeOnTheScreen();
    expect(screen.getByText('Log in again to continue.')).toBeOnTheScreen();
  });

  it('checks the email format before calling the API', async () => {
    await open();

    await logIn('claire');

    expect(
      screen.getByText('Vérifie ton adresse e-mail, elle semble incomplète.'),
    ).toBeOnTheScreen();
    expect(mockAuth.logIn).not.toHaveBeenCalled();
  });

  it('M-20 offline: the error notification, then Try again', async () => {
    onlineManager.setOnline(false); // NetInfo: no connection (QA BUG-A01)
    mockAuth.logIn
      .mockRejectedValueOnce(offlineError())
      .mockResolvedValue({ token: 'jwt-1', user: meFixture });
    const { tokenStore } = await open();

    await logIn();
    expect(await screen.findByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await screen.findByRole('button', { name: 'Me connecter' });
    expect(tokenStore.value).toBe('jwt-1');
  });

  it('hides the password by default and shows it with the eye button', async () => {
    await open();
    const field = screen.getByLabelText('Mot de passe');
    expect(field).toHaveProp('secureTextEntry', true);

    await fireEvent.press(screen.getByRole('button', { name: 'Afficher le mot de passe' }));

    expect(screen.getByLabelText('Mot de passe')).toHaveProp('secureTextEntry', false);
    expect(screen.getByRole('button', { name: 'Masquer le mot de passe' })).toBeOnTheScreen();
  });
});

describe('S6 Forgot password and S7 Link sent', () => {
  beforeEach(async () => {
    resetApiMock();
    await i18n.changeLanguage('fr');
  });

  it('AC-4.1 always shows the same neutral message after sending', async () => {
    mockAuth.requestPasswordReset.mockResolvedValue({ status: 'link_sent_if_account_exists' });
    await open();
    await fireEvent.press(screen.getByRole('link', { name: 'Mot de passe oublié ?' }));
    await screen.findByRole('header', { name: 'Réinitialise ton mot de passe' });

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'anyone@example.com');
    await fireEvent.press(screen.getByRole('button', { name: "M'envoyer un lien" }));

    expect(await screen.findByRole('header', { name: 'Consulte tes e-mails' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Si un compte existe pour cet e-mail, nous t'avons envoyé un lien. Il fonctionne pendant 1 heure.",
      ),
    ).toBeOnTheScreen();
    expect(mockAuth.requestPasswordReset).toHaveBeenCalledWith('anyone@example.com');
    expect(screen.getByRole('button', { name: 'Ouvrir ma messagerie' })).toBeOnTheScreen();
  });

  it('D-6 AC-4.1 rate limited: a neutral error notification, the email stays typed', async () => {
    mockAuth.requestPasswordReset.mockRejectedValue(apiError(429, 'rate_limited'));
    await open();
    await fireEvent.press(screen.getByRole('link', { name: 'Mot de passe oublié ?' }));
    await screen.findByRole('header', { name: 'Réinitialise ton mot de passe' });

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'anyone@example.com');
    await fireEvent.press(screen.getByRole('button', { name: "M'envoyer un lien" }));

    expect(await screen.findByText("Trop d'essais pour le moment")).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Attends quelques minutes, puis réessaie. Si tu as déjà fait la demande, regarde dans tes e-mails et tes spams.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('E-mail')).toHaveProp('value', 'anyone@example.com');
  });
});
