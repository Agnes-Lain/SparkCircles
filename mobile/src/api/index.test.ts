import { jsonResponse } from '../test/fakes';
import { api } from './index';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("the app's API client", () => {
  const originalUrl = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalUrl;
    jest.restoreAllMocks();
  });

  it('signs every request with the platform/version and the install id', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse(200, {}));

    await api().request('/legal', { auth: false });
    await api().request('/legal', { auth: false });

    const headers = fetchSpy.mock.calls.map(
      ([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers,
    );
    expect(headers[0]?.['X-SparkCircles-Client']).toMatch(/^(ios|android)\/\d+\.\d+\.\d+$/);
    expect(headers[0]?.['X-SparkCircles-Device']).toMatch(UUID_V4);
    // One id per install: the same on every request.
    expect(headers[1]?.['X-SparkCircles-Device']).toBe(headers[0]?.['X-SparkCircles-Device']);
  });
});
