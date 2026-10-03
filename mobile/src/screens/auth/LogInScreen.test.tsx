import { fireEvent, screen } from 'expo-router/testing-library';

import i18n from '../../i18n';
import { ME_KEY } from '../../auth/useMe';
import { apiError, mockAuth, offlineError, resetApiMock } from '../../test/apiMock';
import { meFixture } from '../../test/fixtures';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { LinkSentScreen } from './LinkSentScreen';
import { LogInScreen } from './LogInScreen';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);
jest.mock('expo-device', () => ({ modelName: 'iPhone 15' }));

const PASSWORD = `pw-${Math.random().toString(36).slice(2, 12)}-test`;

function open() {
  return renderScreen(
    {
      'log-in': LogInScreen,
      'forgot-password': ForgotPasswordScreen,
      'link-sent': LinkSentScreen,
      'sign-up': routeStub('sign-up'),
    },
    { url: '/log-in' },
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
      await screen.findByText("L'e-mail ou le mot de passe ne correspond pas"),
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

  it('checks the email format before calling the API', async () => {
    await open();

    await logIn('claire');

    expect(
      screen.getByText('Vérifie ton adresse e-mail, elle semble incomplète.'),
    ).toBeOnTheScreen();
    expect(mockAuth.logIn).not.toHaveBeenCalled();
  });

  it('M-20 offline: the error notification, then Try again', async () => {
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
    await fireEvent.press(screen.getByRole('button', { name: 'Envoie-moi un lien' }));

    expect(await screen.findByRole('header', { name: 'Consulte ta boîte mail' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Si un compte existe pour cet e-mail, nous t'avons envoyé un lien. Il fonctionne pendant 1 heure.",
      ),
    ).toBeOnTheScreen();
    expect(mockAuth.requestPasswordReset).toHaveBeenCalledWith('anyone@example.com');
    expect(screen.getByRole('button', { name: 'Ouvrir ma messagerie' })).toBeOnTheScreen();
  });
});
