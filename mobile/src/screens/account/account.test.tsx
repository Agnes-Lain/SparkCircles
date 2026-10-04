import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as Sharing from 'expo-sharing';
import { AccessibilityInfo } from 'react-native';

import i18n from '../../i18n';
import type { Me } from '../../api/types';
import { ME_KEY } from '../../auth/useMe';
import { apiError, mockAccount, mockAuth, offlineError, resetApiMock } from '../../test/apiMock';
import { legalFixture, meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { LinkExpiredScreen } from '../auth/LinkExpiredScreen';
import { AccountClosedScreen } from './AccountClosedScreen';
import { AccountScreen } from './AccountScreen';
import { ChangeEmailScreen } from './ChangeEmailScreen';
import { CloseAccountScreen } from './CloseAccountScreen';
import { DataExportScreen, dataFileName } from './DataExportScreen';
import { EditProfileScreen } from './EditProfileScreen';
import { PrivacyScreen } from './PrivacyScreen';
import { ProfilePreviewScreen } from './ProfilePreviewScreen';
import { SecurityScreen } from './SecurityScreen';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);
const mockFiles: { uri: string; content?: string; exists: boolean }[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: jest.fn().mockImplementation((dir: { uri: string }, name: string) => {
    const file = {
      uri: `${dir.uri}${name}`,
      exists: false,
      content: undefined as string | undefined,
      create: jest.fn(() => {
        file.exists = true;
      }),
      write: jest.fn((text: string) => {
        file.content = text;
      }),
      delete: jest.fn(() => {
        file.exists = false;
      }),
    };
    mockFiles.push(file);
    return file;
  }),
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' },
}));

const ROUTES = {
  'account/index': AccountScreen,
  'account/profile-preview': ProfilePreviewScreen,
  'account/edit-profile': EditProfileScreen,
  'account/change-email': ChangeEmailScreen,
  'account/privacy': PrivacyScreen,
  'account/security': SecurityScreen,
  'my-data': DataExportScreen,
  'close-account': CloseAccountScreen,
  'account-closed': AccountClosedScreen,
  'link-expired': LinkExpiredScreen,
  index: routeStub('home'),
  welcome: routeStub('welcome'),
};

const notVerified: Me['verification'] = {
  ...meFixture.verification,
  status: 'not_verified',
  verified: false,
  expires_on: null,
  submitted_at: null,
};

function withMe(me: Me = meFixture) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ME_KEY, me);
  return queryClient;
}

async function open(url: string, me: Me | null = meFixture) {
  return renderScreen(ROUTES, {
    url,
    token: 'jwt',
    gate: 'ready',
    queryClient: me ? withMe(me) : createTestQueryClient(),
  });
}

beforeEach(async () => {
  resetApiMock();
  // Refetches after a change (GET /me, GET /data_export) answer like the API would.
  mockAuth.me.mockResolvedValue(meFixture);
  mockAccount.dataExport.mockResolvedValue({ data_export: null });
  await i18n.changeLanguage('fr');
});

describe('A1 My account', () => {
  it.each([
    [
      'not verified',
      notVerified,
      'Non vérifiée',
      'Vérifie ton identité pour organiser des sorties',
      "Pour participer à une sortie, ce n'est jamais nécessaire. Environ 3 minutes. Ta vérification est faite sous 48 heures.",
    ],
    [
      'pending',
      { ...notVerified, status: 'pending', submitted_at: '2026-10-02T12:05:00Z' },
      'En attente',
      'Nous vérifions ton identité',
      'En général sous 48 heures. Nous te préviendrons.',
    ],
    [
      'verified',
      meFixture.verification,
      'Vérifiée ✓',
      'Ton identité est vérifiée',
      "Valable jusqu'au 2 oct. 2028.",
    ],
    [
      'expires soon',
      { ...meFixture.verification, expires_on: '2026-11-01', expires_soon: true },
      'Expire bientôt',
      'Ta vérification prend fin le 1 nov.',
      'Vérifie-toi à nouveau avec un document valide pour continuer à organiser des sorties.',
    ],
    [
      'not accepted',
      {
        ...notVerified,
        status: 'rejected',
        rejection: {
          reason: 'photo_blurry',
          message: 'La photo est floue. Prends-en une nouvelle avec une bonne lumière.',
          note: null,
        },
      },
      'Non acceptée',
      "Nous n'avons pas pu vérifier ton identité",
      'La photo est floue. Prends-en une nouvelle avec une bonne lumière.',
    ],
    [
      'expired',
      { ...notVerified, status: 'expired' },
      'Expirée',
      'Ta vérification a pris fin',
      'Les autres ne voient plus ton badge Vérifié. Vérifie-toi à nouveau pour organiser des sorties.',
    ],
    [
      'removed',
      {
        ...notVerified,
        revoked: true,
        rejection: { reason: 'other', message: 'Retirée après un signalement.', note: null },
      },
      'Non vérifiée',
      'Ta vérification a été retirée',
      'Retirée après un signalement.',
    ],
  ] as [string, Me['verification'], string, string, string][])(
    'AC-7.5 AC-6.3 shows the %s badge and card',
    async (_, verification, badge, title, body) => {
      await open('/account', { ...meFixture, verification });

      expect(screen.getByText('Claire M.')).toBeOnTheScreen();
      expect(screen.getByText('c•••••@example.com')).toBeOnTheScreen();
      expect(screen.getByText(badge)).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
      expect(screen.getByText(body)).toBeOnTheScreen();
    },
  );

  it('AC-7.5 shows when a pending verification was sent', async () => {
    await open('/account', {
      ...meFixture,
      verification: { ...notVerified, status: 'pending', submitted_at: '2026-10-02T12:05:00Z' },
    });
    expect(screen.getByText(/^Envoyée le 2 oct\./)).toBeOnTheScreen();
  });

  it('shows a skeleton of the header, card and rows while the account loads', async () => {
    mockAuth.me.mockReturnValue(new Promise(() => undefined));
    await open('/account', null);
    expect(screen.getByTestId('account-loading')).toBeOnTheScreen();
    expect(screen.getByLabelText('Un instant…')).toBeOnTheScreen();
  });

  it('lists the settings and opens each screen', async () => {
    const { app } = await open('/account');

    for (const [label, path] of [
      ['Comment les autres me voient', '/account/profile-preview'],
      ['Modifier mon profil', '/account/edit-profile'],
      ['Confidentialité et messages', '/account/privacy'],
      ['Mot de passe et appareils', '/account/security'],
      ['Obtenir une copie de mes données', '/my-data'],
    ]) {
      mockAccount.publicProfile.mockReturnValue(new Promise(() => undefined));
      mockAccount.dataExport.mockReturnValue(new Promise(() => undefined));
      mockAuth.legal.mockReturnValue(new Promise(() => undefined));
      await fireEvent.press(screen.getByRole('button', { name: label as string }));
      await waitFor(() => expect(app.getPathname()).toBe(path));
      await act(() => router.back());
    }
  });

  it('AC-11.1 offers "Close my account" as a quiet link at the bottom', async () => {
    const { app } = await open('/account');
    await fireEvent.press(screen.getByRole('link', { name: 'Fermer mon compte' }));
    await waitFor(() => expect(app.getPathname()).toBe('/close-account'));
  });

  it('AC-3.5 "Log out" logs this device out with the toast, without confirmation', async () => {
    const { tokenStore } = await open('/account');
    await fireEvent.press(screen.getByRole('button', { name: 'Me déconnecter' }));

    expect(mockAuth.logOut).toHaveBeenCalled();
    expect(await screen.findByText('Déconnexion effectuée')).toBeOnTheScreen();
    expect(tokenStore.value).toBeNull();
  });
});

describe('B1 Badge explanation sheet', () => {
  it('AC-8.3 explains what "Verified" means and doesn\'t mean, and closes with "Got it"', async () => {
    await open('/account');

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Vérifiée, identité contrôlée par SparkCircles. Ouvre une explication.',
      }),
    );
    expect(
      await screen.findByRole('header', { name: 'Identité contrôlée par SparkCircles' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Ce n'est pas une vérification du casier judiciaire"),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Fie-toi toujours à ton propre jugement avec tes enfants.'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: "J'ai compris" }));
    await waitFor(() => expect(screen.queryByTestId('badge-sheet')).toBeNull());
  });

  it('AC-8.3 also opens from "What this means" and closes with the Close button or the scrim', async () => {
    await open('/account');

    await fireEvent.press(screen.getByRole('link', { name: 'Ce que cela signifie' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(screen.queryByTestId('badge-sheet')).toBeNull());

    await fireEvent.press(screen.getByRole('link', { name: 'Ce que cela signifie' }));
    await fireEvent.press(
      await screen.findByTestId('badge-sheet-scrim', { includeHiddenElements: true }),
    );
    await waitFor(() => expect(screen.queryByTestId('badge-sheet')).toBeNull());
  });

  it('AC-8.2 the "Not verified" sheet never says pending, rejected or expired', async () => {
    mockAccount.publicProfile.mockResolvedValue({
      id: meFixture.id,
      first_name: 'Claire',
      last_name_initial: 'M',
      photo_url: null,
      verified: false,
      city_shown: null,
    });
    await open('/account/profile-preview');

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Non vérifiée. Ouvre une explication.' }),
    );
    expect(
      await screen.findByRole('header', { name: 'Identité pas encore vérifiée' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/attente|refus|expir/i)).toBeNull();
  });
});

describe('A2 How others see me', () => {
  it('AC-6.1 AC-6.3 shows exactly the public profile and what is never shown', async () => {
    mockAccount.publicProfile.mockResolvedValue({
      id: meFixture.id,
      first_name: 'Claire',
      last_name_initial: 'M',
      photo_url: null,
      verified: true,
      city_shown: 'Croix-Rousse, Lyon',
    });
    const { app } = await open('/account/profile-preview');

    expect(await screen.findByText('Claire M.')).toBeOnTheScreen();
    expect(screen.getByText('Croix-Rousse, Lyon')).toBeOnTheScreen();
    expect(screen.getByText('Vérifiée ✓')).toBeOnTheScreen();
    expect(screen.queryByText('Martin')).toBeNull();
    expect(
      screen.getByText(
        "Nom de famille complet, e-mail, date de naissance, pièce d'identité et selfie.",
      ),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Modifier mon profil' }));
    await waitFor(() => expect(app.getPathname()).toBe('/account/edit-profile'));
  });

  it('AC-6.1 says when no neighborhood is shown, and shows the error notification offline', async () => {
    mockAccount.publicProfile.mockRejectedValueOnce(offlineError()).mockResolvedValue({
      id: meFixture.id,
      first_name: 'Claire',
      last_name_initial: 'M',
      photo_url: null,
      verified: false,
      city_shown: null,
    });
    await open('/account/profile-preview');

    expect(await screen.findByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Quartier non affiché')).toBeOnTheScreen();
  });
});

describe('A3 Edit profile', () => {
  it('AC-6.1 saves the profile with the "Profile saved" toast', async () => {
    mockAccount.updateProfile.mockResolvedValue({ ...meFixture, city_shown: null });
    await open('/account/edit-profile', { ...meFixture, verification: notVerified });

    await fireEvent.changeText(screen.getByLabelText(/^Ville ou quartier/), '  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(mockAccount.updateProfile).toHaveBeenCalledWith({
      first_name: 'Claire',
      last_name: 'Martin',
      city_shown: null,
    });
    expect(await screen.findByText('Profil enregistré')).toBeOnTheScreen();
  });

  it('AC-7.8 warns a verified parent that a name change removes the badge', async () => {
    mockAccount.updateProfile.mockResolvedValue({ ...meFixture, first_name: 'Clara' });
    await open('/account/edit-profile');

    await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Clara');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('header', { name: 'Changer ton nom ?' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Ton badge Vérifié sera retiré. Tu devras faire vérifier ton identité à nouveau avant d'organiser de nouvelles sorties.",
      ),
    ).toBeOnTheScreen();
    expect(mockAccount.updateProfile).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Changer mon nom' }));
    expect(mockAccount.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: 'Clara' }),
    );
  });

  it('AC-7.8 "Keep my name" saves nothing and restores the name', async () => {
    await open('/account/edit-profile');

    await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Clara');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Garder mon nom' }));

    expect(mockAccount.updateProfile).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Prénom').props.value).toBe('Claire');
  });

  it('asks for the first name when it is empty', async () => {
    await open('/account/edit-profile');
    await fireEvent.changeText(screen.getByLabelText('Prénom'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(screen.getByText('Ajoute ton prénom.')).toBeOnTheScreen();
    expect(mockAccount.updateProfile).not.toHaveBeenCalled();
  });

  it('AC-13.4 shows a waiting email change and sends the link again through Change my email', async () => {
    const { app } = await open('/account/edit-profile', {
      ...meFixture,
      pending_email: 'nouvelle@mail.fr',
    });

    expect(screen.getByText('En attente de confirmation de n•••••@mail.fr')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Renvoyer le lien' }));
    await waitFor(() => expect(app.getPathname()).toBe('/account/change-email'));
    expect(screen.getByLabelText(/^Nouvel e-mail/).props.value).toBe('nouvelle@mail.fr');
  });
});

describe('A3b Change my email', () => {
  async function fill(email: string, password = 'secret-password') {
    await fireEvent.changeText(screen.getByLabelText(/^Nouvel e-mail/), email);
    await fireEvent.changeText(screen.getByLabelText('Ton mot de passe'), password);
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer un lien de confirmation' }));
  }

  it('AC-13.2 AC-13.5 always shows "Check your new inbox" with the masked address', async () => {
    mockAccount.requestEmailChange.mockResolvedValue({ status: 'check_new_inbox' });
    await open('/account/change-email');

    await fill('Nouvelle@Mail.fr');

    expect(mockAccount.requestEmailChange).toHaveBeenCalledWith(
      'nouvelle@mail.fr',
      'secret-password',
    );
    expect(
      await screen.findByRole('header', { name: 'Consulte tes e-mails sur ta nouvelle adresse' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('n•••••@mail.fr')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ouvrir ma messagerie' })).toBeOnTheScreen();
  });

  it("AC-13.1 says the password doesn't match", async () => {
    mockAccount.requestEmailChange.mockRejectedValue(apiError(422, 'invalid_password'));
    await open('/account/change-email');

    await fill('nouvelle@mail.fr', 'wrong-password');

    expect(await screen.findByText('Ce mot de passe ne correspond pas.')).toBeOnTheScreen();
  });

  it('M-3 an empty password shows the field error and announces it', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await open('/account/change-email');

    await fill('nouvelle@mail.fr', '');

    expect(screen.getByText('Saisis ton mot de passe pour continuer.')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Saisis ton mot de passe pour continuer.');
    expect(mockAccount.requestEmailChange).not.toHaveBeenCalled();
    announce.mockRestore();
  });

  it('refuses the current address, before and from the server', async () => {
    await open('/account/change-email');
    await fill('claire@example.com');
    expect(screen.getByText("C'est déjà ton e-mail.")).toBeOnTheScreen();
    expect(mockAccount.requestEmailChange).not.toHaveBeenCalled();

    mockAccount.requestEmailChange.mockRejectedValue(
      apiError(422, 'validation_failed', 'x', { email: ['same_as_current'] }),
    );
    await fill('CLAIRE@example.org');
    expect(await screen.findByText("C'est déjà ton e-mail.")).toBeOnTheScreen();
  });

  it('D-6 shows the rate-limit notification', async () => {
    mockAccount.requestEmailChange.mockRejectedValue(apiError(429, 'rate_limited'));
    await open('/account/change-email');
    await fill('nouvelle@mail.fr');
    expect(await screen.findByText("Trop d'essais pour le moment")).toBeOnTheScreen();
  });
});

describe('A06 expired email-change link on a logged-in phone', () => {
  it('AC-13.3 "Send me a new link" opens Change my email with the waiting address', async () => {
    const { app } = await open('/link-expired?kind=confirm', {
      ...meFixture,
      pending_email: 'nouvelle@mail.fr',
    });

    await fireEvent.press(screen.getByRole('button', { name: "M'envoyer un nouveau lien" }));

    await waitFor(() => expect(app.getPathname()).toBe('/account/change-email'));
    expect(screen.getByLabelText(/^Nouvel e-mail/).props.value).toBe('nouvelle@mail.fr');
    expect(mockAuth.resendConfirmation).not.toHaveBeenCalled();
  });

  it('M-4 waits for the account (skeleton) before showing the waiting address', async () => {
    let answer: (me: Me) => void = () => {};
    mockAuth.me.mockReturnValue(new Promise<Me>((resolve) => (answer = resolve)));
    const { app } = await open('/link-expired?kind=confirm', null);

    await fireEvent.press(screen.getByRole('button', { name: "M'envoyer un nouveau lien" }));

    await waitFor(() => expect(app.getPathname()).toBe('/account/change-email'));
    expect(screen.getByTestId('change-email-loading')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Nouvel e-mail/)).toBeNull();

    await act(async () => answer({ ...meFixture, pending_email: 'nouvelle@mail.fr' }));

    expect((await screen.findByLabelText(/^Nouvel e-mail/)).props.value).toBe('nouvelle@mail.fr');
  });
});

describe('A4 Privacy and messages', () => {
  it('M-7 shows a skeleton while the account loads', async () => {
    mockAuth.me.mockReturnValue(new Promise<Me>(() => {}));
    await open('/account/privacy', null);

    expect(screen.getByTestId('privacy-loading')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('AC-5.4 saves the marketing choice at once with "Saved"', async () => {
    mockAuth.legal.mockResolvedValue(legalFixture);
    mockAccount.setMarketing.mockResolvedValue({
      ...meFixture,
      marketing_opt_in: true,
      marketing_opt_in_changed_at: '2026-10-04T10:00:00Z',
    });
    await open('/account/privacy');

    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Recevoir des nouvelles et des idées de SparkCircles' }),
    );

    expect(mockAccount.setMarketing).toHaveBeenCalledWith(true);
    expect(await screen.findByText('Enregistré')).toBeOnTheScreen();
    expect(await screen.findByText('Modifié le 4 oct. 2026.')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { checked: true })).toBeOnTheScreen();
  });

  it('AC-5.4 keeps the saved choice and shows the error notification when offline', async () => {
    mockAuth.legal.mockResolvedValue(legalFixture);
    mockAccount.setMarketing.mockRejectedValue(offlineError());
    await open('/account/privacy');

    await fireEvent.press(screen.getByRole('checkbox'));

    expect(await screen.findByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { checked: false })).toBeOnTheScreen();
  });

  it('AC-5.2 shows the accepted versions of the terms and the privacy policy', async () => {
    mockAuth.legal.mockResolvedValue(legalFixture);
    await open('/account/privacy');

    expect(screen.getByText('Acceptées le 2 oct. 2026, version 1.0')).toBeOnTheScreen();
    expect(screen.getByText('Acceptée le 2 oct. 2026, version 1.0')).toBeOnTheScreen();
  });
});

describe('A5 Password and devices', () => {
  async function fill(current: string, password: string) {
    await fireEvent.changeText(screen.getByLabelText('Mot de passe actuel'), current);
    await fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), password);
    await fireEvent.press(screen.getByRole('button', { name: 'Changer mon mot de passe' }));
  }

  it('AC-4.4 changes the password with the toast, and says other devices are logged out', async () => {
    mockAccount.changePassword.mockResolvedValue(meFixture);
    await open('/account/security');

    expect(screen.getByText('Tes autres appareils seront déconnectés.')).toBeOnTheScreen();
    await fill('old-password-1', 'new-password-123');

    expect(mockAccount.changePassword).toHaveBeenCalledWith('old-password-1', 'new-password-123');
    expect(await screen.findByText('Mot de passe modifié')).toBeOnTheScreen();
  });

  it("AC-4.4 says the current password doesn't match", async () => {
    mockAccount.changePassword.mockRejectedValue(apiError(422, 'invalid_password'));
    await open('/account/security');

    await fill('wrong-password', 'new-password-123');

    expect(await screen.findByText('Ton mot de passe actuel ne correspond pas.')).toBeOnTheScreen();
  });

  it('AC-1.4 asks for at least 10 characters before sending', async () => {
    await open('/account/security');
    await fill('old-password-1', 'short');
    expect(mockAccount.changePassword).not.toHaveBeenCalled();
    expect(screen.getByTestId('new-password-error')).toBeOnTheScreen();
  });

  it('AC-3.6 logs out of every device after the confirmation sheet', async () => {
    mockAccount.logOutEverywhere.mockResolvedValue(undefined);
    const { tokenStore } = await open('/account/security');

    await fireEvent.press(
      screen.getByRole('button', { name: 'Me déconnecter de tous mes appareils' }),
    );
    expect(
      await screen.findByRole('header', { name: 'Te déconnecter partout ?' }),
    ).toBeOnTheScreen();
    expect(mockAccount.logOutEverywhere).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Me déconnecter partout' }));

    expect(mockAccount.logOutEverywhere).toHaveBeenCalled();
    await waitFor(() => expect(tokenStore.value).toBeNull());
    expect(await screen.findByText('Déconnexion effectuée')).toBeOnTheScreen();
  });

  it('AC-3.6 "Cancel" closes the sheet without logging out', async () => {
    await open('/account/security');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Me déconnecter de tous mes appareils' }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(screen.queryByTestId('log-out-all-sheet')).toBeNull());
    expect(mockAccount.logOutEverywhere).not.toHaveBeenCalled();
  });
});

describe('A6 Copy of my data', () => {
  it('AC-12.1 requests a copy, then shows it as pending with the button disabled', async () => {
    mockAccount.dataExport.mockResolvedValue({ data_export: null });
    mockAccount.requestDataExport.mockResolvedValue({
      data_export: { status: 'pending', requested_at: '2026-10-02T12:05:00Z' },
    });
    await open('/my-data');

    expect(await screen.findByText(/^Tu recevras un fichier/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Demander ma copie' }));

    expect(mockAccount.requestDataExport).toHaveBeenCalled();
    expect(await screen.findByText('En attente')).toBeOnTheScreen();
    expect(
      screen.getByText("Demandée le 2 oct. Nous t'enverrons une notification et un e-mail."),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Demander ma copie' })).toBeDisabled();
  });

  it('AC-12.2 downloads a ready copy as a JSON file, shares it, then deletes it', async () => {
    mockFiles.length = 0;
    let fileWhileSharing: (typeof mockFiles)[number] | undefined;
    const share = jest.mocked(Sharing.shareAsync).mockImplementation(async () => {
      fileWhileSharing = mockFiles[0] && { ...mockFiles[0] };
    });
    mockAccount.dataExport.mockResolvedValue({
      data_export: {
        status: 'ready',
        requested_at: '2026-10-02T12:05:00Z',
        delivered_at: '2026-10-02T13:00:00Z',
        expires_at: '2026-10-09T13:00:00Z',
      },
    });
    mockAccount.downloadDataExport.mockResolvedValue({ account: { first_name: 'Claire' } });
    await open('/my-data');

    expect(await screen.findByText('Tes données sont prêtes')).toBeOnTheScreen();
    expect(
      screen.getByText("Le lien de téléchargement fonctionne jusqu'au 9 oct."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Télécharger mes données' }));

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(
        `file:///cache/${dataFileName()}`,
        expect.objectContaining({ mimeType: 'application/json' }),
      ),
    );
    expect(fileWhileSharing?.exists).toBe(true);
    expect(fileWhileSharing?.content).toContain('"first_name": "Claire"');
    await waitFor(() => expect(mockFiles[0]?.exists).toBe(false));
  });

  it('M-2 names the file with the local date', () => {
    expect(dataFileName(new Date(2026, 9, 4, 23, 30))).toBe('sparkcircles-data-2026-10-04.json');
  });

  it('M-2 deletes the cached file even when the share sheet fails', async () => {
    mockFiles.length = 0;
    jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error('no share sheet'));
    mockAccount.dataExport.mockResolvedValue({
      data_export: {
        status: 'ready',
        requested_at: '2026-10-02T12:05:00Z',
        delivered_at: '2026-10-02T13:00:00Z',
        expires_at: '2026-10-09T13:00:00Z',
      },
    });
    mockAccount.downloadDataExport.mockResolvedValue({ account: { first_name: 'Claire' } });
    await open('/my-data');

    await fireEvent.press(await screen.findByRole('button', { name: 'Télécharger mes données' }));

    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    await waitFor(() => expect(mockFiles[0]?.exists).toBe(false));
  });

  it('AC-12.3 offers a new copy once the link has expired', async () => {
    mockAccount.dataExport.mockResolvedValue({
      data_export: { status: 'expired', requested_at: '2026-09-01T12:05:00Z' },
    });
    mockAccount.requestDataExport.mockResolvedValue({
      data_export: { status: 'pending', requested_at: '2026-10-04T12:05:00Z' },
    });
    await open('/my-data');

    expect(await screen.findByText('Le lien de téléchargement a expiré.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Demander une nouvelle copie' }));
    expect(mockAccount.requestDataExport).toHaveBeenCalled();
  });

  it('shows a skeleton while loading and the error notification offline', async () => {
    let fail: (error: unknown) => void = () => undefined;
    mockAccount.dataExport.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    await open('/my-data');

    expect(screen.getByTestId('data-loading')).toBeOnTheScreen();
    await act(async () => fail(offlineError()));
    expect(await screen.findByText('Impossible de joindre SparkCircles')).toBeOnTheScreen();
  });
});

describe('A7 Close my account', () => {
  it('AC-11.1 explains what happens; the Destructive button waits for the password', async () => {
    await open('/close-account');

    expect(
      screen.getByText('Ton profil disparaît immédiatement pour les autres.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Tous tes appareils sont déconnectés.')).toBeOnTheScreen();
    // M-6: no date computed on the phone; A8 shows the server's date.
    expect(
      screen.getByText('Tes données personnelles sont supprimées dans 30 jours.'),
    ).toBeOnTheScreen();
    const close = screen.getByRole('button', { name: 'Fermer mon compte' });
    expect(close).toBeDisabled();
    expect(screen.getByText('Saisis ton mot de passe pour continuer.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Ton mot de passe'), 'secret-password');
    expect(screen.getByRole('button', { name: 'Fermer mon compte' })).toBeEnabled();
  });

  it("AC-11.1 says the password doesn't match", async () => {
    mockAccount.closeAccount.mockRejectedValue(apiError(422, 'invalid_password'));
    await open('/close-account');

    await fireEvent.changeText(screen.getByLabelText('Ton mot de passe'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer mon compte' }));

    expect(await screen.findByText('Ce mot de passe ne correspond pas.')).toBeOnTheScreen();
  });

  it('AC-11.2 closes the account, shows A8, and "OK" ends on Welcome', async () => {
    mockAccount.closeAccount.mockResolvedValue({
      closure: { closed_at: '2026-10-02T12:05:00Z', erasure_on: '2026-11-01' },
    });
    const { app, tokenStore } = await open('/close-account');

    await fireEvent.changeText(screen.getByLabelText('Ton mot de passe'), 'secret-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer mon compte' }));

    expect(await screen.findByRole('header', { name: 'Ton compte est fermé' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Nous t'avons envoyé un e-mail. Tes données seront supprimées le 1 nov. 2026. Tu as changé d'avis ? Connecte-toi avant cette date.",
      ),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('route:welcome')).toBeOnTheScreen();
    expect(tokenStore.value).toBeNull();
    expect(app.getPathname()).toBe('/welcome');
  });

  it('"Keep my account" goes back without closing', async () => {
    await open('/close-account');
    await fireEvent.press(screen.getByRole('button', { name: 'Garder mon compte' }));
    expect(mockAccount.closeAccount).not.toHaveBeenCalled();
  });
});

describe('English copy', () => {
  it('M-21 shows My account in English', async () => {
    await i18n.changeLanguage('en');
    await open('/account');
    expect(screen.getByRole('header', { name: 'My account' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeOnTheScreen();
  });
});
