import { jsonResponse, memoryTokenStore } from '../test/fakes';
import { meFixture } from '../test/fixtures';
import { createApiClient } from './client';
import { verificationApi } from './verification';

function setup() {
  const fetchImpl = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
  const client = createApiClient({
    baseUrl: 'http://api.test',
    tokenStore: memoryTokenStore('jwt'),
    getLocale: () => 'fr',
    fetchImpl: fetchImpl as unknown as typeof fetch,
    timeoutMs: 20,
  });
  const lastInit = () =>
    fetchImpl.mock.calls.at(-1)?.[1] as RequestInit & { headers: Record<string, string> };
  return { api: verificationApi(client), fetchImpl, lastInit };
}

const photo = (name: string) => ({ uri: `file:///cache/${name}.jpg` });

// React Native's FormData keeps `{ uri, name, type }` file parts; Node's would stringify them.
class FakeFormData {
  parts: [string, unknown][] = [];
  append(name: string, value: unknown) {
    this.parts.push([name, value]);
  }
}
const realFormData = globalThis.FormData;
beforeAll(() => {
  globalThis.FormData = FakeFormData as unknown as typeof FormData;
});
afterAll(() => {
  globalThis.FormData = realFormData;
});
const partsOf = (body: unknown) => (body as FakeFormData).parts;

describe('verification API (contract §6)', () => {
  it('AC-7.3 POST /verification sends a multipart form with the token, no JSON content type', async () => {
    const { api, fetchImpl, lastInit } = setup();
    fetchImpl.mockResolvedValue(
      jsonResponse(201, { verification: { ...meFixture.verification, status: 'pending' } }),
    );

    const result = await api.submit({
      documentType: 'national_id_card',
      front: photo('front'),
      back: photo('back'),
      selfie: photo('selfie'),
      dateOfBirth: '1990-05-14',
    });

    expect(result.verification.status).toBe('pending');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://api.test/api/v1/verification');
    expect(lastInit().method).toBe('POST');
    expect(lastInit().headers.Authorization).toBe('Bearer jwt');
    expect(lastInit().headers['Content-Type']).toBeUndefined();
    const parts = partsOf(lastInit().body);
    expect(parts.map(([name]) => name)).toEqual([
      'document_type',
      'document_front',
      'document_back',
      'selfie',
      'date_of_birth',
    ]);
    expect(parts[1]?.[1]).toEqual({
      uri: 'file:///cache/front.jpg',
      name: 'document_front.jpg',
      type: 'image/jpeg',
    });
    expect(parts[4]).toEqual(['date_of_birth', '1990-05-14']);
  });

  it('AC-7.3 a passport sends no back side', async () => {
    const { api, fetchImpl, lastInit } = setup();
    fetchImpl.mockResolvedValue(jsonResponse(201, { verification: meFixture.verification }));

    await api.submit({
      documentType: 'passport',
      front: photo('front'),
      selfie: photo('selfie'),
      dateOfBirth: '1990-05-14',
    });

    const parts = partsOf(lastInit().body).map(([name]) => name);
    expect(parts).not.toContain('document_back');
  });

  it('gives the upload more time than the usual timeout', async () => {
    jest.useFakeTimers();
    const { api, fetchImpl } = setup();
    let aborted = false;
    fetchImpl.mockImplementation(
      (_url, init) =>
        new Promise((resolve) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
          });
          setTimeout(
            () => resolve(jsonResponse(201, { verification: meFixture.verification })),
            1000,
          );
        }),
    );
    const sent = api.submit({
      documentType: 'passport',
      front: photo('front'),
      selfie: photo('selfie'),
      dateOfBirth: '1990-05-14',
    });
    await jest.advanceTimersByTimeAsync(1000);
    await expect(sent).resolves.toBeDefined();
    expect(aborted).toBe(false);
    jest.useRealTimers();
  });

  it('GET /verification', async () => {
    const { api, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(jsonResponse(200, { verification: meFixture.verification }));
    await expect(api.get()).resolves.toEqual({ verification: meFixture.verification });
  });
});
