import { jsonResponse, memoryTokenStore } from '../test/fakes';
import { meFixture, validationErrorFixture } from '../test/fixtures';
import { createApiClient } from './client';
import { ApiError } from './errors';
import type { Me } from './types';

const BASE = 'http://192.168.1.77:3000';

function setup({ token = 'old-token' as string | null, locale = 'fr' } = {}) {
  const tokenStore = memoryTokenStore(token);
  const fetchImpl = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
  const onUnauthorized = jest.fn();
  const client = createApiClient({
    baseUrl: `${BASE}/`,
    tokenStore,
    getLocale: () => locale,
    onUnauthorized,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    timeoutMs: 50,
  });
  const lastInit = () =>
    fetchImpl.mock.calls.at(-1)?.[1] as RequestInit & { headers: Record<string, string> };
  return { client, tokenStore, fetchImpl, onUnauthorized, lastInit };
}

describe('API client', () => {
  it('calls /api/v1 with JSON, Accept-Language and the bearer token', async () => {
    const { client, fetchImpl, lastInit } = setup({ locale: 'en' });
    fetchImpl.mockResolvedValue(jsonResponse(200, meFixture));

    const me = await client.request<Me>('/me');

    expect(me.first_name).toBe('Claire');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/v1/me`);
    expect(lastInit().headers).toMatchObject({
      Accept: 'application/json',
      'Accept-Language': 'en',
      Authorization: 'Bearer old-token',
    });
  });

  it('sends a JSON body and no token when auth is false (e.g. login)', async () => {
    const { client, fetchImpl, lastInit } = setup();
    fetchImpl.mockResolvedValue(jsonResponse(201, { token: 'new', user: meFixture }));

    await client.request('/sessions', { method: 'POST', auth: false, body: { email: 'a@b.c' } });

    expect(lastInit().method).toBe('POST');
    expect(lastInit().headers['Content-Type']).toBe('application/json');
    expect(lastInit().headers.Authorization).toBeUndefined();
    expect(lastInit().body).toBe(JSON.stringify({ email: 'a@b.c' }));
  });

  describe('token renewal (AC-3.4, contract §1)', () => {
    it('AC-3.4 stores the renewed token sent in the Authorization response header', async () => {
      const { client, fetchImpl, tokenStore } = setup();
      fetchImpl.mockResolvedValue(
        jsonResponse(200, meFixture, { Authorization: 'Bearer renewed-token' }),
      );

      await client.request('/me');

      expect(tokenStore.setToken).toHaveBeenCalledWith('renewed-token');
      expect(tokenStore.value).toBe('renewed-token');
    });

    it('AC-3.4 uses the renewed token on the next request', async () => {
      const { client, fetchImpl, lastInit } = setup();
      fetchImpl
        .mockResolvedValueOnce(
          jsonResponse(200, meFixture, { Authorization: 'Bearer renewed-token' }),
        )
        .mockResolvedValueOnce(jsonResponse(200, meFixture));

      await client.request('/me');
      await client.request('/me');

      expect(lastInit().headers.Authorization).toBe('Bearer renewed-token');
    });

    it('keeps the stored token when the header repeats it or is absent', async () => {
      const { client, fetchImpl, tokenStore } = setup();
      fetchImpl
        .mockResolvedValueOnce(jsonResponse(200, meFixture, { Authorization: 'Bearer old-token' }))
        .mockResolvedValueOnce(jsonResponse(200, meFixture));

      await client.request('/me');
      await client.request('/me');

      expect(tokenStore.setToken).not.toHaveBeenCalled();
    });

    it('ignores an Authorization header on a request sent without a token', async () => {
      const { client, fetchImpl, tokenStore } = setup({ token: null });
      fetchImpl.mockResolvedValue(
        jsonResponse(202, { status: 'check_inbox' }, { Authorization: 'Bearer x' }),
      );

      await client.request('/registrations', { method: 'POST', auth: false, body: {} });

      expect(tokenStore.setToken).not.toHaveBeenCalled();
    });
  });

  describe('401 handling', () => {
    it('AC-3.6 clears the token and ends the session on 401 unauthorized', async () => {
      const { client, fetchImpl, tokenStore, onUnauthorized } = setup();
      fetchImpl.mockResolvedValue(
        jsonResponse(401, { error: { code: 'unauthorized', message: 'Log in again.' } }),
      );

      await expect(client.request('/me')).rejects.toMatchObject({
        status: 401,
        code: 'unauthorized',
      });

      expect(tokenStore.clearToken).toHaveBeenCalled();
      expect(tokenStore.value).toBeNull();
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('AC-3.2 keeps the session for 401 invalid_credentials (a login form error)', async () => {
      const { client, fetchImpl, tokenStore, onUnauthorized } = setup();
      fetchImpl.mockResolvedValue(
        jsonResponse(401, {
          error: { code: 'invalid_credentials', message: "Email or password doesn't match" },
        }),
      );

      await expect(client.request('/sessions', { method: 'POST' })).rejects.toMatchObject({
        code: 'invalid_credentials',
      });

      expect(tokenStore.clearToken).not.toHaveBeenCalled();
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('does not save a renewed token from a 401 answer', async () => {
      const { client, fetchImpl, tokenStore } = setup();
      fetchImpl.mockResolvedValue(
        jsonResponse(
          401,
          { error: { code: 'unauthorized', message: 'x' } },
          { Authorization: 'Bearer y' },
        ),
      );

      await expect(client.request('/me')).rejects.toBeInstanceOf(ApiError);
      expect(tokenStore.setToken).not.toHaveBeenCalled();
    });
  });

  describe('errors', () => {
    it('maps validation errors with their field keys', async () => {
      const { client, fetchImpl } = setup();
      fetchImpl.mockResolvedValue(jsonResponse(422, validationErrorFixture));

      const error = await client
        .request('/registrations', { method: 'POST' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 422,
        code: 'validation_failed',
        details: { password: ['too_short'] },
      });
    });

    it('maps account gates (403) to their code', async () => {
      const { client, fetchImpl } = setup();
      fetchImpl.mockResolvedValue(
        jsonResponse(403, { error: { code: 'email_not_confirmed', message: 'x' } }),
      );

      await expect(client.request('/users/1')).rejects.toMatchObject({
        status: 403,
        code: 'email_not_confirmed',
      });
    });

    it('turns an undocumented error body into unexpected_response', async () => {
      const { client, fetchImpl } = setup();
      fetchImpl.mockResolvedValue(new Response('<html>oops</html>', { status: 500 }));

      await expect(client.request('/me')).rejects.toMatchObject({
        status: 500,
        code: 'unexpected_response',
      });
    });

    it('reports network_error when the server cannot be reached', async () => {
      const { client, fetchImpl } = setup();
      fetchImpl.mockRejectedValue(new TypeError('Network request failed'));

      const error = (await client.request('/me').catch((e: unknown) => e)) as ApiError;

      expect(error.code).toBe('network_error');
      expect(error.isOffline).toBe(true);
    });

    it('reports timeout when the server is too slow', async () => {
      const { client, fetchImpl } = setup();
      fetchImpl.mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      );

      await expect(client.request('/me')).rejects.toMatchObject({ code: 'timeout' });
    });
  });

  it('returns undefined for 204 No Content (logout)', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      client.request('/sessions/current', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });

  describe('health check', () => {
    it('calls GET /up outside /api/v1, without a token', async () => {
      const { client, fetchImpl, lastInit } = setup();
      fetchImpl.mockResolvedValue(new Response('<html></html>', { status: 200 }));

      await expect(client.health()).resolves.toBe(true);

      expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/up`);
      expect((lastInit().headers as unknown) ?? {}).not.toHaveProperty('Authorization');
    });

    it('fails when /up does not answer 200', async () => {
      const { client, fetchImpl } = setup();
      fetchImpl.mockResolvedValue(new Response('', { status: 503 }));

      await expect(client.health()).rejects.toMatchObject({ status: 503 });
    });
  });
});
