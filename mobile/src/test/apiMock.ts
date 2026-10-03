// Shared mock of src/api for screen and gate tests:
//   import { mockAuth, resetApiMock } from '../test/apiMock';
//   jest.mock('../api', () => jest.requireActual('../test/apiMock').apiModule);
import type { AuthApi } from '../api/auth';
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

export const mockHealth = jest.fn();

export const apiModule = {
  api: () => ({ health: mockHealth, request: jest.fn() }),
  auth: () => mockAuth,
  ApiError,
};

export function resetApiMock() {
  Object.values(mockAuth).forEach((fn) => fn.mockReset());
  mockHealth.mockReset().mockResolvedValue(true);
  mockAuth.logOut.mockResolvedValue(undefined);
}

/** An API error as the client throws it. */
export function apiError(status: number, code: ApiError['code'], message: string = code) {
  return new ApiError(status, code, message);
}

export const offlineError = () => new ApiError(0, 'network_error', 'offline');
