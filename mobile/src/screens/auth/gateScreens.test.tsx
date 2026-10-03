import { act, fireEvent, screen } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import i18n from '../../i18n';
import { setPendingEmail } from '../../auth/pendingEmail';
import { ME_KEY } from '../../auth/useMe';
import { LOCALE_KEY } from '../../i18n/localeStore';
import { mockAuth, offlineError, resetApiMock } from '../../test/apiMock';
import { closingMe, legalFixture, meFixture, termsMe, unconfirmedMe } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { CheckInboxScreen, RESEND_COOLDOWN_MS } from './CheckInboxScreen';
import { ClosureScreen } from './ClosureScreen';
import { TermsUpdatedScreen } from './TermsUpdatedScreen';
import { WelcomeScreen } from './WelcomeScreen';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' },
}));

function withMe(me: typeof meFixture) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ME_KEY, me);
  return queryClient;
}

describe('S1 Welcome', () => {
  beforeEach(() => i18n.changeLanguage('fr'));

  it('offers to create an account (Primary) or log in (Ghost)', async () => {
    await renderScreen(
      { welcome: WelcomeScreen, 'sign-up': routeStub('sign-up'), 'log-in': routeStub('log-in') },
      { url: '/welcome' },
    );

    expect(screen.getByLabelText('SparkCircles')).toBeOnTheScreen();
    expect(
      screen.getByText('Organise la vie de famille avec les familles près de chez toi.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(await screen.findByText('route:sign-up')).toBeOnTheScreen();
  });

  it('M-21 switches to English and remembers the choice on the device', async () => {
    await renderScreen({ welcome: WelcomeScreen }, { url: '/welcome' });

    await fireEvent.press(screen.getByRole('link', { name: 'English' }));

    expect(await screen.findByRole('button', { name: 'Create my account' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Français' })).toBeOnTheScreen();
    await expect(SecureStore.getItemAsync(LOCALE_KEY)).resolves.toBe('en');
  });
});

describe('S3 Check your inbox', () => {
  beforeEach(async () => {
    resetApiMock();
    setPendingEmail(null);
    await i18n.changeLanguage('fr');
  });

  it('AC-2.3 AC-2.4 for a logged-in unconfirmed account: masked email, spam and 7-day notes', async () => {
    await renderScreen(
      { 'check-inbox': CheckInboxScreen },
      {
        url: '/check-inbox',
        token: 'jwt',
        gate: 'unconfirmed',
        queryClient: withMe(unconfirmedMe),
      },
    );

    expect(screen.getByText('c•••••@example.com')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Regarde dans tes spams. Les comptes non confirmés sont supprimés au bout de 7 jours.',
      ),
    ).toBeOnTheScreen();
  });

  it('AC-2.2 sends the link again, then waits a moment before allowing another', async () => {
    jest.useFakeTimers();
    mockAuth.resendConfirmation.mockResolvedValue({ status: 'check_inbox' });
    setPendingEmail('claire@gmail.com');
    await renderScreen({ 'check-inbox': CheckInboxScreen }, { url: '/check-inbox' });

    await fireEvent.press(screen.getByRole('button', { name: 'Renvoyer le lien' }));

    expect(
      await screen.findByText('Nouveau lien envoyé. Tu pourras en redemander un dans un instant.'),
    ).toBeOnTheScreen();
    expect(mockAuth.resendConfirmation).toHaveBeenCalledWith('claire@gmail.com');
    expect(screen.getByRole('button', { name: 'Renvoyer le lien' })).toBeDisabled();

    await act(() => jest.advanceTimersByTime(RESEND_COOLDOWN_MS));
    expect(screen.getByRole('button', { name: 'Renvoyer le lien' })).toBeEnabled();
    jest.useRealTimers();
  });

  it('M-20 shows the error notification when the resend cannot reach the API', async () => {
    mockAuth.resendConfirmation.mockRejectedValue(offlineError());
    setPendingEmail('claire@gmail.com');
    await renderScreen({ 'check-inbox': CheckInboxScreen }, { url: '/check-inbox' });

    await fireEvent.press(screen.getByRole('button', { name: 'Renvoyer le lien' }));

    expect(await screen.findByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
  });

  it('opens the mail app', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    setPendingEmail('claire@gmail.com');
    await renderScreen({ 'check-inbox': CheckInboxScreen }, { url: '/check-inbox' });

    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir ma messagerie' }));

    expect(openURL).toHaveBeenCalledWith(Platform.OS === 'ios' ? 'message:' : 'mailto:');
  });

  it('AC-3.5 "Log out" logs the unconfirmed device out', async () => {
    const { tokenStore } = await renderScreen(
      { 'check-inbox': CheckInboxScreen },
      {
        url: '/check-inbox',
        token: 'jwt',
        gate: 'unconfirmed',
        queryClient: withMe(unconfirmedMe),
      },
    );

    await fireEvent.press(screen.getByRole('link', { name: 'Me déconnecter' }));

    expect(await screen.findByText('Déconnexion effectuée')).toBeOnTheScreen();
    expect(mockAuth.logOut).toHaveBeenCalled();
    expect(tokenStore.value).toBeNull();
  });
});

describe('S9 Terms updated', () => {
  beforeEach(async () => {
    resetApiMock();
    await i18n.changeLanguage('fr');
  });

  it('AC-5.5 shows what changed, the documents, and records the acceptance', async () => {
    mockAuth.legal.mockResolvedValue(legalFixture);
    mockAuth.acceptTerms.mockResolvedValue(meFixture);
    const { queryClient } = await renderScreen(
      { 'terms-updated': TermsUpdatedScreen },
      { url: '/terms-updated', token: 'jwt', gate: 'terms', queryClient: withMe(termsMe) },
    );

    expect(await screen.findByText('We now explain how long we keep your data.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Lire les conditions complètes' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://sparkcircles.fr/terms',
      expect.anything(),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Accepter et continuer' }));

    expect(mockAuth.acceptTerms).toHaveBeenCalledWith('1.1', '1.1');
    expect(queryClient.getQueryData(ME_KEY)).toEqual(meFixture);
  });

  it('shows a skeleton of the card while the terms load', async () => {
    mockAuth.legal.mockReturnValue(new Promise(() => undefined));
    await renderScreen(
      { 'terms-updated': TermsUpdatedScreen },
      { url: '/terms-updated', token: 'jwt', gate: 'terms', queryClient: withMe(termsMe) },
    );

    expect(screen.getByLabelText('Un instant…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Accepter et continuer' })).toBeDisabled();
  });

  it('M-20 shows the error notification when the terms cannot be loaded', async () => {
    mockAuth.legal.mockRejectedValue(offlineError());
    await renderScreen(
      { 'terms-updated': TermsUpdatedScreen },
      { url: '/terms-updated', token: 'jwt', gate: 'terms', queryClient: withMe(termsMe) },
    );

    expect(await screen.findByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
  });
});

describe('S10 Closure in progress', () => {
  beforeEach(async () => {
    resetApiMock();
    await i18n.changeLanguage('fr');
  });

  it('AC-11.3 shows the erasure date and keeps the account', async () => {
    mockAuth.cancelClosure.mockResolvedValue(meFixture);
    const { queryClient } = await renderScreen(
      { 'account-closing': ClosureScreen },
      { url: '/account-closing', token: 'jwt', gate: 'closing', queryClient: withMe(closingMe) },
    );

    expect(screen.getByText('12 nov. 2026')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Garder mon compte' }));

    expect(
      await screen.findByText('Bon retour parmi nous. Ton compte est de nouveau actif.'),
    ).toBeOnTheScreen();
    expect(queryClient.getQueryData(ME_KEY)).toEqual(meFixture);
  });

  it('writes the date in English for English speakers', async () => {
    await i18n.changeLanguage('en');
    await renderScreen(
      { 'account-closing': ClosureScreen },
      { url: '/account-closing', token: 'jwt', gate: 'closing', queryClient: withMe(closingMe) },
    );

    expect(screen.getByText('12 Nov 2026')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Your account is closing' })).toBeOnTheScreen();
  });
});
