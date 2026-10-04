import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as WebBrowser from 'expo-web-browser';
import { AccessibilityInfo } from 'react-native';

import i18n from '../../i18n';
import { setPendingEmail } from '../../auth/pendingEmail';
import { apiError, mockAuth, offlineError, resetApiMock } from '../../test/apiMock';
import { legalFixture } from '../../test/fixtures';
import { renderScreen } from '../../test/renderScreen';
import { ApiError } from '../../api/errors';
import { CheckInboxScreen } from './CheckInboxScreen';
import { SignUpScreen } from './SignUpScreen';

afterEach(() => onlineManager.setOnline(true));

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' },
}));

// Generated per run: no password literal in the repository.
const PASSWORD = `pw-${Math.random().toString(36).slice(2, 12)}-test`;

function open() {
  return renderScreen(
    { 'sign-up': SignUpScreen, 'check-inbox': CheckInboxScreen },
    { url: '/sign-up' },
  );
}

async function fillValidForm() {
  await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Claire');
  await fireEvent.changeText(screen.getByLabelText('Nom'), 'Martin');
  await fireEvent.changeText(screen.getByLabelText('E-mail'), ' claire@gmail.com ');
  await fireEvent.changeText(screen.getByLabelText('Mot de passe'), PASSWORD);
  await fireEvent.press(screen.getByRole('checkbox', { name: "J'ai 18 ans ou plus" }));
  await fireEvent.press(
    screen.getByRole('checkbox', {
      name: "J'accepte les conditions d'utilisation et la politique de confidentialité",
    }),
  );
}

describe('S2 Sign up', () => {
  beforeEach(async () => {
    resetApiMock();
    setPendingEmail(null);
    await i18n.changeLanguage('fr');
  });

  it('AC-1.6 asks only first name, last name, email and password, with visible labels', async () => {
    await open();

    expect(screen.getByRole('header', { name: 'Crée ton compte' })).toBeOnTheScreen();
    ['Prénom', 'Nom', 'E-mail', 'Mot de passe'].forEach((label) => {
      expect(screen.getByText(label)).toBeOnTheScreen();
      expect(screen.getByLabelText(label)).toBeOnTheScreen();
    });
    expect(
      screen.getAllByLabelText(/./, { exact: false }).filter((e) => e.type === 'TextInput'),
    ).toHaveLength(4);
    expect(screen.getByText('Les autres ne voient que la première lettre.')).toBeOnTheScreen();
  });

  it('AC-5.1 AC-5.3 the three boxes are unticked by default; marketing is optional', async () => {
    await open();

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    boxes.forEach((box) => expect(box).not.toBeChecked());
    expect(
      screen.getByRole('checkbox', {
        name: 'Recevoir des nouvelles et des idées de SparkCircles (facultatif)',
      }),
    ).toBeOnTheScreen();
  });

  it('AC-1.2 says which box is missing and creates nothing', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await open();
    await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Claire');
    await fireEvent.changeText(screen.getByLabelText('Nom'), 'Martin');
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'claire@gmail.com');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), PASSWORD);

    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));

    const adultError =
      'Coche cette case pour confirmer que tu as 18 ans ou plus. SparkCircles est réservé aux adultes.';
    expect(screen.getByText(adultError)).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Coche cette case pour accepter les conditions d'utilisation et la politique de confidentialité.",
      ),
    ).toBeOnTheScreen();
    expect(mockAuth.register).not.toHaveBeenCalled();
    // The first error is announced (design system section 8).
    expect(announce).toHaveBeenCalledWith(adultError);
  });

  it('AC-1.4 explains what a valid password needs (short, or common per the API)', async () => {
    await open();
    await fillValidForm();
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'court');

    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));

    const message =
      'Utilise au moins 10 caractères et évite les mots de passe courants comme « motdepasse123 ».';
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(mockAuth.register).not.toHaveBeenCalled();

    mockAuth.register.mockRejectedValue(
      new ApiError(422, 'validation_failed', 'x', { password: ['too_common'] }),
    );
    // While in error, the field's label also reads the error (QA BUG-A05).
    await fireEvent.changeText(screen.getByLabelText(`Mot de passe. ${message}`), 'motdepasse123');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByText(message)).toBeOnTheScreen();
  });

  it('shows the field errors from the design for empty names and an incomplete email', async () => {
    await open();
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'claire@');

    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(screen.getByText('Ajoute ton prénom.')).toBeOnTheScreen();
    expect(screen.getByText('Ajoute ton nom.')).toBeOnTheScreen();
    expect(
      screen.getByText('Vérifie ton adresse e-mail, elle semble incomplète.'),
    ).toBeOnTheScreen();
  });

  it('AC-1.1 AC-1.3 sends the form, then Check your inbox with the address partly masked', async () => {
    mockAuth.register.mockResolvedValue({ status: 'check_inbox' });
    const { app } = await open();
    await fillValidForm();

    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByRole('header', { name: 'Consulte tes e-mails' })).toBeOnTheScreen();
    expect(mockAuth.register).toHaveBeenCalledWith({
      first_name: 'Claire',
      last_name: 'Martin',
      email: 'claire@gmail.com',
      password: PASSWORD,
      adult_confirmed: true,
      terms_accepted: true,
      marketing_opt_in: false,
      locale: 'fr',
    });
    expect(screen.getByText('c•••••@gmail.com')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/check-inbox');
  });

  it('AC-5.1 opens the terms in an in-app sheet, keeping the form', async () => {
    mockAuth.legal.mockResolvedValue(legalFixture);
    await open();
    await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Claire');

    await fireEvent.press(screen.getByText("conditions d'utilisation"));

    await waitFor(() =>
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://sparkcircles.fr/terms', {
        presentationStyle: 'pageSheet',
      }),
    );
    expect(screen.getByLabelText('Prénom')).toHaveDisplayValue('Claire');
  });

  it('M-20 offline: the error notification, the form is kept, Try again sends it again', async () => {
    onlineManager.setOnline(false); // NetInfo: no connection (QA BUG-A01)
    mockAuth.register
      .mockRejectedValueOnce(offlineError())
      .mockResolvedValue({ status: 'check_inbox' });
    await open();
    await fillValidForm();

    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
    expect(screen.getByLabelText('Prénom')).toHaveDisplayValue('Claire');

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('header', { name: 'Consulte tes e-mails' })).toBeOnTheScreen();
  });

  it('D-6 rate limited: the error notification, what was typed is kept', async () => {
    mockAuth.register.mockRejectedValue(apiError(429, 'rate_limited'));
    await open();
    await fillValidForm();

    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByText("Trop d'essais pour le moment")).toBeOnTheScreen();
    expect(
      screen.getByText('Attends quelques minutes, puis réessaie. Ce que tu as saisi est conservé.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Prénom')).toHaveProp('value', 'Claire');
    expect(screen.getByLabelText('Mot de passe')).toHaveProp('value', PASSWORD);
    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeEnabled();
  });
});
