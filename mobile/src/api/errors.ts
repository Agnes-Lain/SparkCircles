import type { ApiErrorBody, ApiErrorCode, FieldErrorKey } from './types';

/** The one error type the app sees from the API client, whatever went wrong. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: Record<string, FieldErrorKey[]>;
  /** Events `not_enough_places`: the places still free (docs/api/events.md, section 1). */
  readonly placesLeft?: number;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, FieldErrorKey[]>,
    placesLeft?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.placesLeft = placesLeft;
  }

  /** True when the server couldn't be reached at all (show the "couldn't reach" notification). */
  get isOffline(): boolean {
    return this.code === 'network_error' || this.code === 'timeout';
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}
