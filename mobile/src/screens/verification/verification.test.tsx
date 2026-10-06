import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as ImagePicker from 'expo-image-picker';
import { AccessibilityInfo, Linking } from 'react-native';

import type { Me, Verification } from '../../api/types';
import { ME_KEY } from '../../auth/useMe';
import i18n from '../../i18n';
import {
  apiError,
  mockAuth,
  mockVerification,
  offlineError,
  resetApiMock,
} from '../../test/apiMock';
import { cameraState, mockRequestPermission, mockTakePicture } from '../../test/cameraMock';
import { meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { AccountScreen } from '../account/AccountScreen';
import { DocumentCaptureRoute, SelfieCaptureRoute } from './CaptureScreen';
import { DocumentTypeScreen } from './DocumentTypeScreen';
import { VerificationFlowProvider as around } from './flow';
import { checkDateOfBirth, dateOfBirthRange, ReviewScreen } from './ReviewScreen';
import { StatusScreen } from './StatusScreen';
import { VerifyGateScreen } from './VerifyGateScreen';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

// The test renderer has no native tags: give the focused element one (QA-V8).
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (instance: unknown) => (instance ? 42 : null),
}));

jest.mock('expo-camera', () => jest.requireActual('../../test/cameraMock').cameraModule);
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
let mockSaved = 0;
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => {
      const context = {
        resize: () => context,
        renderAsync: async () => ({
          saveAsync: async () => ({ uri: `file:///cache/ImageManipulator/${++mockSaved}.jpg` }),
        }),
        release: () => undefined,
      };
      return context;
    },
  },
}));
const mockDeleted: string[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  Directory: jest.fn().mockImplementation(() => ({
    exists: false,
    create: () => undefined,
    delete: () => undefined,
  })),
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    exists: true,
    delete: () => mockDeleted.push(uri),
    moveSync: () => undefined,
  })),
}));

const ROUTES = {
  'account/index': AccountScreen,
  'verify/index': VerifyGateScreen,
  'verify/document': DocumentTypeScreen,
  'verify/capture': DocumentCaptureRoute,
  'verify/selfie': SelfieCaptureRoute,
  'verify/review': ReviewScreen,
  'verify/status': StatusScreen,
  index: routeStub('home'),
};

const notVerified: Verification = {
  ...meFixture.verification,
  status: 'not_verified',
  verified: false,
  expires_on: null,
  submitted_at: null,
};
const pending: Verification = {
  ...notVerified,
  status: 'pending',
  submitted_at: '2026-10-02T12:05:00Z',
};
const rejected: Verification = {
  ...notVerified,
  status: 'rejected',
  rejection: {
    reason: 'photo_blurry',
    message: 'La photo est floue. Prends-en une nouvelle avec une bonne lumière.',
    note: null,
  },
};
const renewalPending: Verification = {
  ...meFixture.verification,
  expires_on: '2026-11-01',
  expires_soon: true,
  renewal: { status: 'pending', submitted_at: '2026-10-03T08:00:00Z', rejection: null },
};

async function open(url: string, verification: Verification = notVerified) {
  const queryClient = createTestQueryClient();
  const me: Me = { ...meFixture, verification };
  queryClient.setQueryData(ME_KEY, me);
  mockVerification.get.mockResolvedValue({ verification });
  return renderScreen(ROUTES, { url, token: 'jwt', gate: 'ready', queryClient, around });
}

// Presses inside an async act: a navigation started by a plain press can otherwise still be
// settling when the next test renders.
async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => fireEvent.press(element));
}

let shot = 0;
function nextShot() {
  shot += 1;
  return { uri: `file:///cache/Camera/shot-${shot}.jpg`, width: 4032, height: 3024 };
}

async function takeAndUse() {
  await press(screen.getByLabelText('Prendre la photo'));
  await press(await screen.findByText('Utiliser cette photo'));
}

/** Backlog #30: the native date picker (iOS sheet in tests), then "OK". */
async function fillDateOfBirth(day: string, month: string, year: string) {
  await press(screen.getByTestId('dob'));
  await act(async () => {
    fireEvent(screen.getByTestId('dob-picker'), 'onChange', {
      nativeEvent: {
        timestamp: new Date(Number(year), Number(month) - 1, Number(day)).getTime(),
        utcOffset: 0,
      },
    });
  });
  await press(screen.getByTestId('dob-done'));
}

/** V1 → V4 for a document type, every photo taken with the camera. */
async function reachReview(document: string, twoSided: boolean) {
  await open('/verify/document');
  await press(screen.getByText(document));
  await takeAndUse();
  if (twoSided) await takeAndUse();
  await screen.findByText('Maintenant, un selfie');
  await takeAndUse();
  await screen.findByText('Dernière étape');
}

beforeEach(async () => {
  resetApiMock();
  mockAuth.me.mockResolvedValue(meFixture);
  cameraState.permission = { status: 'granted', granted: true, canAskAgain: true };
  mockRequestPermission.mockReset();
  mockTakePicture.mockReset().mockImplementation(async () => nextShot());
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockReset();
  mockDeleted.length = 0;
  await i18n.changeLanguage('fr');
});

// renderRouter runs on fake timers: let the last navigation of a test settle before the next
// test renders.
afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
});

describe('A1 verification card buttons (M-1)', () => {
  it.each([
    ['not verified', notVerified, 'Vérifier mon identité', 'verify-gate'],
    ['pending', pending, 'Voir le détail', 'status-pending'],
    ['not accepted', rejected, 'Réessayer', 'verify-gate'],
    ['expired', { ...notVerified, status: 'expired' }, 'Vérifier à nouveau', 'verify-gate'],
    [
      'expires soon',
      { ...meFixture.verification, expires_on: '2026-11-01', expires_soon: true },
      'Vérifier à nouveau',
      'verify-gate',
    ],
    [
      'removed',
      {
        ...notVerified,
        revoked: true,
        rejection: { reason: 'other', message: 'Retirée.', note: null },
      },
      'Vérifier à nouveau',
      'verify-gate',
    ],
  ] as [string, Verification, string, string][])(
    'AC-7.5 %s: the card button opens the right screen',
    async (_, verification, label, target) => {
      await open('/account', verification);
      await press(screen.getByRole('button', { name: label }));
      expect(await screen.findByTestId(target)).toBeOnTheScreen();
    },
  );

  it('QA-V1 AC-7.15 verified, more than 30 days left: no renewal entry, only "What this means"', async () => {
    await open('/account', meFixture.verification);
    expect(screen.queryByTestId('verification-action')).toBeNull();
    expect(screen.queryByText('Vérifier à nouveau')).toBeNull();
    expect(screen.getByText('Ce que cela signifie')).toBeOnTheScreen();
  });

  it('QA-V1 AC-7.15 expires soon: "Vérifier à nouveau" leads into the renewal flow', async () => {
    await open('/account', {
      ...meFixture.verification,
      expires_on: '2026-11-01',
      expires_soon: true,
    });
    await press(screen.getByRole('button', { name: 'Vérifier à nouveau' }));
    await press(await screen.findByRole('button', { name: 'Vérifier mon identité' }));
    expect(await screen.findByText('Quel document as-tu ?')).toBeOnTheScreen();
  });

  it('AC-7.15 a renewal under review shows "Renouvellement en attente" and "Voir le détail"', async () => {
    await open('/account', renewalPending);
    expect(screen.getByText('Expire bientôt')).toBeOnTheScreen();
    expect(screen.getByText('Renouvellement en attente')).toBeOnTheScreen();
    await press(screen.getByRole('button', { name: 'Voir le détail' }));
    expect(await screen.findByTestId('status-renewal-pending')).toBeOnTheScreen();
  });
});

describe('V0 Verify to host', () => {
  it('AC-7.1 AC-7.2 explains why, what is needed and the privacy promise', async () => {
    await open('/verify');
    expect(
      screen.getByRole('header', { name: 'Vérifie ton identité pour organiser des sorties' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/jamais nécessaire/)).toBeOnTheScreen();
    expect(screen.getByText('Un selfie, pris maintenant')).toBeOnTheScreen();
    expect(screen.getByText(/effacées dans les 30 jours/)).toBeOnTheScreen();
    await press(screen.getByRole('button', { name: 'Vérifier mon identité' }));
    expect(await screen.findByText('Quel document as-tu ?')).toBeOnTheScreen();
    expect(screen.getByText('Étape 1 sur 4')).toBeOnTheScreen();
  });

  it('AC-7.5 a pending parent sees the pending variant, not a second verification', async () => {
    await open('/verify', pending);
    expect(screen.getByTestId('verify-gate-pending')).toBeOnTheScreen();
    expect(screen.getByText('Nous vérifions ton identité')).toBeOnTheScreen();
    expect(screen.queryByText('Vérifier mon identité')).toBeNull();
  });
});

describe('V1 Which document do you have?', () => {
  it('AC-7.3 AC-7.4 lists the accepted documents and says it must not be expired', async () => {
    await open('/verify/document');
    for (const name of [
      'Passeport',
      'Carte nationale d’identité'.replace('’', "'"),
      'Permis de conduire',
      'Titre de séjour',
      'Autre carte de séjour officielle',
    ]) {
      expect(screen.getByText(name)).toBeOnTheScreen();
    }
    expect(screen.getByText('Page photo')).toBeOnTheScreen();
    expect(screen.getByText('Ton document ne doit pas être expiré.')).toBeOnTheScreen();
  });
});

describe('V2 / V3 capture', () => {
  it('AC-7.3 a passport has one photo, then the selfie with the front camera', async () => {
    await open('/verify/document');
    await press(screen.getByText('Passeport'));
    expect(await screen.findByText('Page photo de ton passeport')).toBeOnTheScreen();
    expect(screen.getByText('Étape 2 sur 4')).toBeOnTheScreen();
    expect(screen.getByTestId('camera').props.facing).toBe('back');
    await takeAndUse();
    expect(await screen.findByText('Maintenant, un selfie')).toBeOnTheScreen();
    expect(screen.getByText('Étape 3 sur 4')).toBeOnTheScreen();
    expect(screen.getByTestId('camera').props.facing).toBe('front');
  });

  it('AC-7.3 a two-sided document asks for the back after the front', async () => {
    await open('/verify/document');
    await press(screen.getByText('Permis de conduire'));
    expect(await screen.findByText('Recto de ton permis de conduire')).toBeOnTheScreen();
    await takeAndUse();
    expect(await screen.findByText('Verso de ton permis de conduire')).toBeOnTheScreen();
  });

  it('shows the frame, tips and a labelled 64 px shutter; takes the photo without EXIF', async () => {
    await open('/verify/document');
    await press(screen.getByText('Passeport'));
    const shutter = await screen.findByLabelText('Prendre la photo');
    expect(shutter).toHaveStyle({ width: 64, height: 64 });
    expect(
      screen.getByLabelText(/Conseils: Bonne lumière, Les 4 coins visibles, Pas de reflet/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Vue de l’appareil photo'.replace('’', "'"))).toBeOnTheScreen();
    await press(shutter);
    await screen.findByText('Utiliser cette photo');
    expect(mockTakePicture).toHaveBeenCalledWith({ quality: 1, exif: false });
  });

  it('announces the check step, and "La reprendre" erases the photo and reopens the camera', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation();
    await open('/verify/document');
    await press(screen.getByText('Passeport'));
    await press(await screen.findByLabelText('Prendre la photo'));
    expect(await screen.findByRole('header', { name: 'Tout est lisible ?' })).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Photo prise.');
    // QA-V8: the screen reader's focus moves to the check step's heading.
    expect(focus).toHaveBeenCalledWith(42);
    expect(screen.getByLabelText('La photo que tu as prise')).toBeOnTheScreen();
    // The camera's own file is erased once the shrunk copy exists.
    expect(mockDeleted).toContain('file:///cache/Camera/shot-' + shot + '.jpg');

    await press(screen.getByText('La reprendre'));
    expect(mockDeleted).toContain(`file:///cache/ImageManipulator/${mockSaved}.jpg`);
    expect(screen.getByLabelText('Prendre la photo')).toBeOnTheScreen();
  });

  it('"Choisir dans mes photos" opens the system picker for one image', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/ImagePicker/pick.jpg', width: 3000, height: 2000 }],
    } as ImagePicker.ImagePickerResult);
    await open('/verify/document');
    await press(screen.getByText('Passeport'));
    await press(await screen.findByText('Choisir dans mes photos'));
    expect(await screen.findByText('Utiliser cette photo')).toBeOnTheScreen();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'], exif: false, allowsEditing: false }),
    );
    expect(mockDeleted).toContain('file:///cache/ImagePicker/pick.jpg');
  });

  it('a cancelled picker changes nothing', async () => {
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValue({ canceled: true, assets: null });
    await open('/verify/document');
    await press(screen.getByText('Passeport'));
    await press(await screen.findByText('Choisir dans mes photos'));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    expect(screen.queryByText('Utiliser cette photo')).toBeNull();
  });

  it('camera denied: explains it and opens the settings', async () => {
    cameraState.permission = { status: 'denied', granted: false, canAskAgain: false };
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await open('/verify/document');
    await press(screen.getByText('Passeport'));
    expect(
      await screen.findByText("SparkCircles a besoin d'accéder à ton appareil photo"),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('camera')).toBeNull();
    expect(screen.getByLabelText('Prendre la photo')).toBeDisabled();
    await press(screen.getByRole('button', { name: 'Ouvrir les réglages' }));
    expect(openSettings).toHaveBeenCalled();
    // The photo picker still works without the camera.
    expect(screen.getByText('Choisir dans mes photos')).toBeOnTheScreen();
  });

  it('asks for the camera on the first visit', async () => {
    cameraState.permission = { status: 'undetermined', granted: false, canAskAgain: true };
    await open('/verify/document');
    await press(screen.getByText('Passeport'));
    await waitFor(() => expect(mockRequestPermission).toHaveBeenCalled());
  });

  it('a failed shot says so and keeps the camera', async () => {
    mockTakePicture.mockRejectedValueOnce(new Error('camera busy'));
    await open('/verify/document');
    await press(screen.getByText('Passeport'));
    await press(await screen.findByLabelText('Prendre la photo'));
    expect(
      await screen.findByText('La photo n’a pas fonctionné'.replace('’', "'")),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Prendre la photo')).toBeOnTheScreen();
  });

  it('reduced motion: no shutter animation', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await open('/verify/document');
    await press(screen.getByText('Passeport'));
    await waitFor(() => expect(screen.getByTestId('camera').props.animateShutter).toBe(false));
  });
});

describe('V4 Date of birth and check', () => {
  it('AC-7.3 lists each photo with a labelled "Reprendre"', async () => {
    await reachReview("Carte nationale d'identité", true);
    expect(screen.getByText("Carte d'identité, recto")).toBeOnTheScreen();
    expect(screen.getByText("Carte d'identité, verso")).toBeOnTheScreen();
    expect(screen.getByText('Selfie')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: "Reprendre : Carte d'identité, verso" }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/effacées dans les 30 jours/)).toBeOnTheScreen();
  });

  it('"Reprendre" retakes one photo and comes back to the check, erasing the old one', async () => {
    await reachReview('Passeport', false);
    const before = mockSaved;
    await press(screen.getByRole('button', { name: 'Reprendre : Selfie' }));
    await takeAndUse();
    expect(await screen.findByText('Dernière étape')).toBeOnTheScreen();
    expect(mockDeleted).toContain(`file:///cache/ImageManipulator/${before}.jpg`);
  });

  it('checks the date of birth before sending (none picked)', async () => {
    await reachReview('Passeport', false);
    await press(screen.getByText('Envoyer pour vérification'));
    expect(screen.getByText('Ajoute ta date de naissance.')).toBeOnTheScreen();
    expect(mockVerification.submit).not.toHaveBeenCalled();
  });

  it('18+ is checked again before sending, whatever the picker allowed', async () => {
    await reachReview('Passeport', false);
    await fillDateOfBirth('14', '05', '2012');
    await press(screen.getByText('Envoyer pour vérification'));
    expect(
      screen.getByText('Tu dois avoir 18 ans ou plus pour vérifier ton identité.'),
    ).toBeOnTheScreen();
    expect(mockVerification.submit).not.toHaveBeenCalled();
  });

  it('AC-7.3 sends the photos and date, erases the photos, then shows "Vérification envoyée" with 48 h', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    let finish: (value: unknown) => void = () => undefined;
    mockVerification.submit.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await reachReview("Carte nationale d'identité", true);
    await fillDateOfBirth('14', '5', '1990');

    await press(screen.getByText('Envoyer pour vérification'));
    await press(screen.getByTestId('send-for-review')); // double tap: one request
    expect(await screen.findByText('Envoi sécurisé de tes photos…')).toBeOnTheScreen();
    expect(mockVerification.submit).toHaveBeenCalledTimes(1);
    const submission = mockVerification.submit.mock.calls[0][0];
    expect(submission).toMatchObject({
      documentType: 'national_id_card',
      dateOfBirth: '1990-05-14',
    });
    expect(submission.front.uri).toMatch(/ImageManipulator/);
    expect(submission.back.uri).toMatch(/ImageManipulator/);
    expect(submission.selfie.uri).toMatch(/ImageManipulator/);

    await act(async () => finish({ verification: pending }));
    expect(await screen.findByTestId('status-pending')).toBeOnTheScreen();
    expect(screen.getByText('Vérification envoyée')).toBeOnTheScreen();
    expect(screen.getByText('48 h')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Vérification envoyée');
    for (const photo of [submission.front, submission.back, submission.selfie]) {
      expect(mockDeleted).toContain(photo.uri);
    }
  });

  it('offline: designed error, photos kept on the device, can send again', async () => {
    mockVerification.submit.mockRejectedValueOnce(offlineError());
    await reachReview('Passeport', false);
    await fillDateOfBirth('14', '05', '1990');
    const kept = mockDeleted.length;
    await press(screen.getByText('Envoyer pour vérification'));
    expect(await screen.findByText("Tes photos n'ont pas été envoyées")).toBeOnTheScreen();
    expect(screen.getByText('Vérifie ta connexion et réessaie.')).toBeOnTheScreen();
    expect(mockDeleted).toHaveLength(kept);

    mockVerification.submit.mockResolvedValueOnce({ verification: pending });
    await press(screen.getByText('Envoyer pour vérification'));
    expect(await screen.findByTestId('status-pending')).toBeOnTheScreen();
  });

  it('429: asks to wait a few minutes', async () => {
    mockVerification.submit.mockRejectedValueOnce(apiError(429, 'rate_limited'));
    await reachReview('Passeport', false);
    await fillDateOfBirth('14', '05', '1990');
    await press(screen.getByText('Envoyer pour vérification'));
    expect(await screen.findByText("Trop d'essais pour le moment")).toBeOnTheScreen();
  });

  it('422 / 413: marks the photos to take again', async () => {
    mockVerification.submit.mockRejectedValueOnce(
      apiError(422, 'validation_failed', 'Check', { selfie: ['too_large'] }),
    );
    await reachReview('Passeport', false);
    await fillDateOfBirth('14', '05', '1990');
    await press(screen.getByText('Envoyer pour vérification'));
    expect(
      await screen.findByText('Reprends les photos indiquées, puis envoie-les.'),
    ).toBeOnTheScreen();
    expect(screen.getAllByText('Reprends cette photo.')).toHaveLength(1);
  });

  it('QA-V3 #30 the date of birth is one native picker labelled "Date de naissance", 18+ built in', async () => {
    await reachReview('Passeport', false);
    expect(screen.getByText('Date de naissance')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Date de naissance, Choisis ta date de naissance' }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('dob-day')).toBeNull();
    await press(screen.getByTestId('dob'));
    const picker = screen.getByTestId('dob-picker');
    const now = new Date();
    const ago = (years: number) =>
      new Date(now.getFullYear() - years, now.getMonth(), now.getDate()).getTime();
    expect(picker.props.date).toBe(ago(35));
    expect(picker.props.maximumDate).toBe(ago(18));
    expect(picker.props.minimumDate).toBe(ago(100));
    expect(picker.props.locale).toBe('fr-FR');
    expect(picker.props.themeVariant).toBe('light');
    expect(picker.props.accessibilityLabel).toBe('Date de naissance');
    await act(async () => {
      fireEvent(picker, 'onChange', {
        nativeEvent: { timestamp: new Date(1990, 4, 14).getTime(), utcOffset: 0 },
      });
    });
    await press(screen.getByTestId('dob-done'));
    expect(
      screen.getByRole('button', { name: 'Date de naissance, 14 mai 1990' }),
    ).toBeOnTheScreen();
  });

  it('QA-V4 422 date of birth (under 18 for the server): shows the 18+ message', async () => {
    mockVerification.submit.mockRejectedValueOnce(
      apiError(422, 'validation_failed', 'Check', { date_of_birth: ['invalid'] }),
    );
    await reachReview('Passeport', false);
    await fillDateOfBirth('14', '05', '1990');
    await press(screen.getByText('Envoyer pour vérification'));
    expect(
      await screen.findByText('Tu dois avoir 18 ans ou plus pour vérifier ton identité.'),
    ).toBeOnTheScreen();
  });

  it('AC-7.4 an expired document: says so and offers another document', async () => {
    mockVerification.submit.mockRejectedValueOnce(
      apiError(422, 'validation_failed', 'Check', { document_front: ['expired'] }),
    );
    await reachReview('Passeport', false);
    await fillDateOfBirth('14', '05', '1990');
    await press(screen.getByText('Envoyer pour vérification'));
    expect(
      await screen.findByText('Ce document est expiré. Utilise un document valide.'),
    ).toBeOnTheScreen();
    await press(screen.getByRole('button', { name: 'Choisir un autre document' }));
    expect(await screen.findByText('Quel document as-tu ?')).toBeOnTheScreen();
  });

  it('AC-7.5 one already pending (409): shows the pending status', async () => {
    mockVerification.submit.mockRejectedValueOnce(apiError(409, 'verification_pending'));
    await reachReview('Passeport', false);
    mockVerification.get.mockResolvedValue({ verification: pending });
    await fillDateOfBirth('14', '05', '1990');
    await press(screen.getByText('Envoyer pour vérification'));
    expect(await screen.findByTestId('status-pending')).toBeOnTheScreen();
  });

  it('#30 checks picked dates the API way', () => {
    const today = new Date(2026, 9, 4);
    expect(checkDateOfBirth(new Date(2008, 9, 4), today)).toEqual({ value: '2008-10-04' });
    expect(checkDateOfBirth(new Date(2008, 9, 5), today)).toEqual({ error: 'dobUnderage' });
    expect(checkDateOfBirth(null, today)).toEqual({ error: 'dobBlank' });
    expect(checkDateOfBirth(new Date(1926, 9, 3), today)).toEqual({ error: 'dobInvalid' });
    expect(dateOfBirthRange(today)).toEqual({
      min: new Date(1926, 9, 4),
      max: new Date(2008, 9, 4),
      initial: new Date(1991, 9, 4),
    });
  });
});

describe('V5 Verification status', () => {
  it('AC-7.3 AC-7.5 pending: 48 h promise and the timeline', async () => {
    await open('/verify/status', pending);
    expect(await screen.findByText('Vérification envoyée')).toBeOnTheScreen();
    expect(screen.getByText('En attente')).toBeOnTheScreen();
    expect(screen.getByText('Délai habituel de vérification')).toBeOnTheScreen();
    expect(screen.getByText('Tu ne peux pas organiser de sorties en attendant')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retour à mon compte' })).toBeOnTheScreen();
  });

  it('AC-7.6 AC-7.11 verified: valid until the expiry date', async () => {
    await open('/verify/status', meFixture.verification);
    expect(await screen.findByText('Ton identité est vérifiée')).toBeOnTheScreen();
    expect(screen.getByText('2 oct. 2028')).toBeOnTheScreen();
    expect(screen.getByText("Valable jusqu'au")).toBeOnTheScreen();
  });

  it('AC-7.7 not accepted: the reason in plain words and "Réessayer"', async () => {
    await open('/verify/status', rejected);
    expect(await screen.findByText('On réessaie')).toBeOnTheScreen();
    expect(screen.getByText(rejected.rejection!.message)).toBeOnTheScreen();
    await press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Quel document as-tu ?')).toBeOnTheScreen();
  });

  it('QA-V1 AC-7.15 verified, more than 30 days left: no renewal entry on V5', async () => {
    await open('/verify/status', meFixture.verification);
    expect(await screen.findByTestId('status-verified')).toBeOnTheScreen();
    expect(screen.queryByText('Vérifier à nouveau')).toBeNull();
    expect(screen.queryByTestId('status-action')).toBeNull();
  });

  it('AC-7.13 expired: "Vérifier à nouveau"', async () => {
    await open('/verify/status', { ...notVerified, status: 'expired' });
    expect(await screen.findByText('Ta vérification a pris fin')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Vérifier à nouveau' })).toBeOnTheScreen();
  });

  it('AC-7.12 expires soon: "Vérifier à nouveau"', async () => {
    await open('/verify/status', {
      ...meFixture.verification,
      expires_on: '2026-11-01',
      expires_soon: true,
    });
    expect(await screen.findByText('Ta vérification prend fin le 1 nov.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Vérifier à nouveau' })).toBeOnTheScreen();
  });

  it('AC-7.15 renewal pending: stays verified, shown as "Renouvellement en attente"', async () => {
    await open('/verify/status', renewalPending);
    expect(await screen.findByText('Renouvellement en attente')).toBeOnTheScreen();
    expect(screen.getByText(/Ton identité reste vérifiée pendant que/)).toBeOnTheScreen();
    expect(
      screen.getByText('Tu peux continuer à organiser des sorties en attendant'),
    ).toBeOnTheScreen();
  });

  it('AC-7.15 renewal refused: keeps the old verification and can try again', async () => {
    await open('/verify/status', {
      ...renewalPending,
      renewal: {
        status: 'rejected',
        submitted_at: '2026-10-03T08:00:00Z',
        rejection: { reason: 'photo_blurry', message: 'La photo est floue.', note: null },
      },
    });
    expect(
      await screen.findByText("Ton identité reste vérifiée jusqu'au 1 nov. 2026."),
    ).toBeOnTheScreen();
    expect(screen.getByText('La photo est floue.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
  });

  it('refreshes the status from GET /verification', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(ME_KEY, { ...meFixture, verification: pending });
    mockVerification.get.mockResolvedValue({ verification: meFixture.verification });
    await renderScreen(ROUTES, {
      url: '/verify/status',
      token: 'jwt',
      gate: 'ready',
      queryClient,
      around,
    });
    expect(await screen.findByText('Ton identité est vérifiée')).toBeOnTheScreen();
    expect(queryClient.getQueryData<Me>(ME_KEY)?.verification.status).toBe('verified');
  });

  it('English copy', async () => {
    await i18n.changeLanguage('en');
    await open('/verify/status', pending);
    expect(await screen.findByText('Verification sent')).toBeOnTheScreen();
    expect(screen.getByText('Usual review time')).toBeOnTheScreen();
  });
});
