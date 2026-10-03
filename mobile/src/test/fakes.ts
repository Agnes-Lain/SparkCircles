import type { TokenStore } from '../auth/tokenStore';

/** In-memory TokenStore for client tests. */
type MemoryTokenStore = {
  value: string | null;
  getToken: jest.Mock<Promise<string | null>, []>;
  setToken: jest.Mock<Promise<void>, [string]>;
  clearToken: jest.Mock<Promise<void>, []>;
};

export function memoryTokenStore(initial: string | null = null): TokenStore & MemoryTokenStore {
  const store: MemoryTokenStore = {
    value: initial,
    getToken: jest.fn(async () => store.value),
    setToken: jest.fn(async (token: string) => {
      store.value = token;
    }),
    clearToken: jest.fn(async () => {
      store.value = null;
    }),
  };
  return store;
}

/** A fetch Response built from JSON (or an empty body) with optional headers. */
export function jsonResponse(
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
