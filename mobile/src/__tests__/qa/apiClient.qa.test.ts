// QA (mobile-setup): API client behaviour from proposal M-15 / M-21 not covered elsewhere.
import { createApiClient } from '../../api/client';
import i18n, { currentLocale } from '../../i18n';
import { jsonResponse, memoryTokenStore } from '../../test/fakes';

describe('QA API client', () => {
  afterEach(() => jest.useRealTimers());

  it('sends Accept-Language from the current app language (fr, then en)', async () => {
    const fetchImpl = jest.fn().mockImplementation(async () => jsonResponse(200, {}));
    const client = createApiClient({
      baseUrl: 'http://api.test/',
      tokenStore: memoryTokenStore(null),
      getLocale: currentLocale,
      fetchImpl,
    });
    await i18n.changeLanguage('fr');
    await client.request('/me', { auth: false });
    await i18n.changeLanguage('en');
    await client.request('/me', { auth: false });
    expect(fetchImpl.mock.calls.map((c) => c[1].headers['Accept-Language'])).toEqual(['fr', 'en']);
    // Trailing slash in EXPO_PUBLIC_API_URL is tolerated.
    expect(fetchImpl.mock.calls[0][0]).toBe('http://api.test/api/v1/me');
    await i18n.changeLanguage('fr');
  });

  it('times out after 15 s by default with the `timeout` code', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const client = createApiClient({
      baseUrl: 'http://api.test',
      tokenStore: memoryTokenStore('t'),
      getLocale: () => 'fr',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const pending = client.request('/me');
    const outcome = pending.catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(14_999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(2);
    await expect(outcome).resolves.toMatchObject({ status: 0, code: 'timeout', isOffline: true });
  });

  it('never logs the token', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, {}, { Authorization: 'Bearer renewed-secret' }))
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'unauthorized', message: 'x' } }));
    const client = createApiClient({
      baseUrl: 'http://api.test',
      tokenStore: memoryTokenStore('secret-token'),
      getLocale: () => 'fr',
      fetchImpl,
    });
    await client.request('/me');
    await client.request('/me').catch(() => undefined);
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toMatch(/secret/);
    spies.forEach((s) => s.mockRestore());
  });
});
