import { act, fireEvent, screen } from 'expo-router/testing-library';
import * as ImagePicker from 'expo-image-picker';

import type { Me, Verification } from '../../api/types';
import { ME_KEY } from '../../auth/useMe';
import i18n from '../../i18n';
import { apiError, mockAuth, mockVerification, resetApiMock } from '../../test/apiMock';
import { cameraState, mockRequestPermission, mockTakePicture } from '../../test/cameraMock';
import { meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { AccountScreen } from '../account/AccountScreen';
import { DocumentCaptureRoute, SelfieCaptureRoute } from './CaptureScreen';
import { DocumentTypeScreen } from './DocumentTypeScreen';
import { VerificationFlowProvider as around } from './flow';
import { ReviewScreen } from './ReviewScreen';
import { StatusScreen } from './StatusScreen';
import { VerifyGateScreen } from './VerifyGateScreen';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

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

async function fillDateOfBirth(day: string, month: string, year: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId('dob-day'), day);
    fireEvent.changeText(screen.getByTestId('dob-month'), month);
    fireEvent.changeText(screen.getByTestId('dob-year'), year);
  });
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

describe('QA: uncovered criteria', () => {
  it('DOB fields: number pads, labelled Jour / Mois / Année', async () => {
    await reachReview('Passeport', false);
    for (const [id, label, max] of [
      ['dob-day', 'Jour', 2],
      ['dob-month', 'Mois', 2],
      ['dob-year', 'Année', 4],
    ] as const) {
      const input = screen.getByTestId(id);
      expect(input.props.keyboardType).toBe('number-pad');
      expect(input.props.maxLength).toBe(max);
      expect(screen.getAllByLabelText(label).length).toBeGreaterThan(0);
    }
  });

  it('18+ rule: an under-18 date shows the designed message and sends nothing', async () => {
    await reachReview('Passeport', false);
    const year = String(new Date().getFullYear() - 10);
    await fillDateOfBirth('01', '01', year);
    await press(screen.getByText('Envoyer pour vérification'));
    expect(await screen.findByText(/18 ans ou plus/)).toBeOnTheScreen();
    expect(mockVerification.submit).not.toHaveBeenCalled();
  });

  it('413: marks the photos to take again', async () => {
    mockVerification.submit.mockRejectedValueOnce(apiError(413, 'unexpected_response'));
    await reachReview('Passeport', false);
    await fillDateOfBirth('14', '05', '1990');
    await press(screen.getByText('Envoyer pour vérification'));
    expect(
      await screen.findByText('Reprends les photos indiquées, puis envoie-les.'),
    ).toBeOnTheScreen();
  });

  it('a double tap on "Envoyer" sends once', async () => {
    mockVerification.submit.mockReturnValue(new Promise(() => undefined));
    await reachReview('Passeport', false);
    await fillDateOfBirth('14', '05', '1990');
    const send = screen.getByTestId('send-for-review');
    await press(send);
    await press(send);
    expect(mockVerification.submit).toHaveBeenCalledTimes(1);
  });

  it('leaving the flow from V4 with "back" to My account erases every photo', async () => {
    await reachReview('Passeport', false);
    const shots = [...Array(2)].map(
      (_, i) => `file:///cache/ImageManipulator/${mockSaved - i}.jpg`,
    );
    await act(async () => screen.unmount());
    for (const uri of shots) expect(mockDeleted).toContain(uri);
  });
});
