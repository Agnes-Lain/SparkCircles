import * as SecureStore from 'expo-secure-store';

/** Where the device's API token lives. Only ever expo-secure-store, never AsyncStorage (M-18). */
export type TokenStore = {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
};

export const TOKEN_KEY = 'sparkcircles.auth.token';

// Readable after the first unlock (so background refreshes work) and never copied to
// another device or into an iCloud / Google backup.
export const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/**
 * Token store backed by the iOS Keychain / Android Keystore. Writes are serialized so a
 * renewal and a logout can't interleave, and the value is cached in memory after the
 * first read.
 */
export function createSecureTokenStore(store: typeof SecureStore = SecureStore): TokenStore {
  let cache: string | null | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  return {
    getToken: () =>
      enqueue(async () => {
        if (cache === undefined) cache = await store.getItemAsync(TOKEN_KEY, SECURE_STORE_OPTIONS);
        return cache;
      }),
    setToken: (token) =>
      enqueue(async () => {
        await store.setItemAsync(TOKEN_KEY, token, SECURE_STORE_OPTIONS);
        cache = token;
      }),
    clearToken: () =>
      enqueue(async () => {
        cache = null;
        await store.deleteItemAsync(TOKEN_KEY, SECURE_STORE_OPTIONS);
      }),
  };
}

export const secureTokenStore = createSecureTokenStore();
