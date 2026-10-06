// Shared mock of src/api for screen and gate tests:
//   import { mockAuth, resetApiMock } from '../test/apiMock';
//   jest.mock('../api', () => jest.requireActual('../test/apiMock').apiModule);
import type { AccountApi } from '../api/account';
import type { AuthApi } from '../api/auth';
import type { EventsApi } from '../api/events';
import type { VerificationApi } from '../api/verification';
import { ApiError } from '../api/errors';

type MockedAuth = { [K in keyof AuthApi]: jest.Mock };

export const mockAuth: MockedAuth = {
  me: jest.fn(),
  register: jest.fn(),
  confirmEmail: jest.fn(),
  resendConfirmation: jest.fn(),
  logIn: jest.fn(),
  logOut: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  reportEmailChange: jest.fn(),
  legal: jest.fn(),
  acceptTerms: jest.fn(),
  cancelClosure: jest.fn(),
};

type MockedAccount = { [K in keyof AccountApi]: jest.Mock };

export const mockAccount: MockedAccount = {
  logOutEverywhere: jest.fn(),
  changePassword: jest.fn(),
  updateProfile: jest.fn(),
  publicProfile: jest.fn(),
  setMarketing: jest.fn(),
  requestEmailChange: jest.fn(),
  closeAccount: jest.fn(),
  dataExport: jest.fn(),
  requestDataExport: jest.fn(),
  downloadDataExport: jest.fn(),
};

type MockedVerification = { [K in keyof VerificationApi]: jest.Mock };

export const mockVerification: MockedVerification = {
  get: jest.fn(),
  submit: jest.fn(),
};

type MockedEvents = { [K in keyof EventsApi]: jest.Mock };

export const mockEvents: MockedEvents = {
  options: jest.fn(),
  search: jest.fn(),
  get: jest.fn(),
  mine: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  publish: jest.fn(),
  cancel: jest.fn(),
  join: jest.fn(),
  changePlaces: jest.fn(),
  leave: jest.fn(),
  withdrawRequest: jest.fn(),
  requests: jest.fn(),
  acceptRequest: jest.fn(),
  declineRequest: jest.fn(),
  acceptAll: jest.fn(),
  report: jest.fn(),
};

export const mockHealth = jest.fn();

export const apiModule = {
  api: () => ({ health: mockHealth, request: jest.fn() }),
  auth: () => mockAuth,
  account: () => mockAccount,
  verification: () => mockVerification,
  events: () => mockEvents,
  ApiError,
};

export function resetApiMock() {
  Object.values(mockAuth).forEach((fn) => fn.mockReset());
  Object.values(mockAccount).forEach((fn) => fn.mockReset());
  Object.values(mockVerification).forEach((fn) => fn.mockReset());
  Object.values(mockEvents).forEach((fn) => fn.mockReset());
  // The Sorties tab searches at once ("Tout Paris" by default): an empty page unless a test
  // says otherwise.
  const empty = { events: [], pagination: { page: 1, per_page: 20, next_page: null } };
  mockEvents.search.mockResolvedValue(empty);
  mockEvents.mine.mockResolvedValue(empty);
  mockHealth.mockReset().mockResolvedValue(true);
  mockAuth.logOut.mockResolvedValue(undefined);
}

/** An API error as the client throws it. */
export function apiError(
  status: number,
  code: ApiError['code'],
  message: string = code,
  details?: ApiError['details'],
) {
  return new ApiError(status, code, message, details);
}

export const offlineError = () => new ApiError(0, 'network_error', 'offline');
