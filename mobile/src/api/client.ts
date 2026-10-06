import type { TokenStore } from '../auth/tokenStore';
import { CLIENT_HEADER, DEVICE_HEADER } from './appSignature';
import { ApiError, isApiErrorBody } from './errors';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestOptions = {
  method?: Method;
  /** JSON body (sent as application/json). */
  body?: unknown;
  /** Multipart body (verification upload). Mutually exclusive with `body`. */
  formData?: FormData;
  /** Send the stored token. Default true; false for sign-up, login, reset… */
  auth?: boolean;
  signal?: AbortSignal;
  /** Overrides the client's timeout, e.g. for the verification photo upload. */
  timeoutMs?: number;
};

export type ApiClientConfig = {
  /** EXPO_PUBLIC_API_URL, e.g. http://192.168.1.77:3000 (no trailing /api/v1). */
  baseUrl: string;
  tokenStore: TokenStore;
  /** Current app language, sent as Accept-Language (contract §1). */
  getLocale: () => string;
  /** Called after a 401 `unauthorized` cleared the token: the session is over (AC-3.4, 3.6). */
  onUnauthorized?: () => void;
  /** App signature sent on every request (X-SparkCircles-Client), e.g. `ios/1.0.0`. */
  clientSignature?: string;
  /** Per-install device id sent on every request (X-SparkCircles-Device). */
  getDeviceId?: () => Promise<string>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * Typed fetch wrapper for the SparkCircles API (proposal M-15). The only place in the
 * app that calls `fetch`. Never logs URLs, bodies or tokens (AC-10.6).
 */
export function createApiClient(config: ApiClientConfig) {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const fetchImpl = config.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const timeoutMs = config.timeoutMs ?? 15_000;

  /** The app signature headers, on every request (Events API contract, "Guest access"). */
  async function signatureHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (config.clientSignature) headers[CLIENT_HEADER] = config.clientSignature;
    if (config.getDeviceId) headers[DEVICE_HEADER] = await config.getDeviceId();
    return headers;
  }

  async function send(
    url: string,
    init: RequestInit,
    signal?: AbortSignal,
    timeout: number = timeoutMs,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } catch {
      if (controller.signal.aborted && !signal?.aborted) {
        throw new ApiError(0, 'timeout', 'The server took too long to answer.');
      }
      throw new ApiError(0, 'network_error', 'The server could not be reached.');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, formData, auth = true, signal, timeoutMs: timeout } = options;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Language': config.getLocale(),
      ...(await signatureHeaders()),
    };
    const token = auth ? await config.tokenStore.getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    let payload: BodyInit | undefined;
    if (formData) {
      payload = formData; // fetch sets the multipart boundary itself
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const response = await send(
      `${baseUrl}/api/v1${path}`,
      { method, headers, body: payload },
      signal,
      timeout,
    );

    // Token renewal (contract §1, AC-3.4): a response to an authenticated request may carry
    // a renewed token in its Authorization header; it replaces the stored one.
    if (token && response.ok) {
      const renewed = BEARER.exec(response.headers.get('Authorization') ?? '')?.[1];
      if (renewed && renewed !== token) await config.tokenStore.setToken(renewed);
    }

    const data = await readJson(response);

    if (!response.ok) {
      const error = isApiErrorBody(data)
        ? new ApiError(response.status, data.error.code, data.error.message, data.error.details)
        : new ApiError(
            response.status,
            'unexpected_response',
            `Unexpected ${response.status} response.`,
          );
      // A refused token ends the session on this device. `invalid_credentials` (wrong
      // password at login) is also a 401 but is a form error, not a logout.
      if (token && error.status === 401 && error.code === 'unauthorized') {
        await config.tokenStore.clearToken();
        config.onUnauthorized?.();
      }
      throw error;
    }

    return data as T;
  }

  /** Rails health check `GET /up` (outside /api/v1): true when the API answers 200. */
  async function health(signal?: AbortSignal): Promise<true> {
    const response = await send(
      `${baseUrl}/up`,
      { method: 'GET', headers: await signatureHeaders() },
      signal,
    );
    if (!response.ok) {
      throw new ApiError(
        response.status,
        'unexpected_response',
        `Health check answered ${response.status}.`,
      );
    }
    return true;
  }

  return { request, health };
}

export type ApiClient = ReturnType<typeof createApiClient>;

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
