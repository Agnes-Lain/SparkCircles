import * as SecureStore from 'expo-secure-store';

import { createSecureTokenStore, TOKEN_KEY } from './tokenStore';

const mocked = SecureStore as jest.Mocked<typeof SecureStore> & { __reset: () => void };

describe('secure token store (M-18)', () => {
  beforeEach(() => {
    mocked.__reset();
    jest.clearAllMocks();
  });

  it('keeps the token in expo-secure-store, this device only', async () => {
    const store = createSecureTokenStore();

    await store.setToken('jwt-1');

    expect(mocked.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, 'jwt-1', {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    await expect(createSecureTokenStore().getToken()).resolves.toBe('jwt-1');
  });

  it('returns null when no token is stored', async () => {
    await expect(createSecureTokenStore().getToken()).resolves.toBeNull();
  });

  it('reads the keychain once, then from memory', async () => {
    const store = createSecureTokenStore();
    await store.getToken();
    await store.getToken();
    expect(mocked.getItemAsync).toHaveBeenCalledTimes(1);
  });

  it('clears the token', async () => {
    const store = createSecureTokenStore();
    await store.setToken('jwt-1');

    await store.clearToken();

    expect(mocked.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY, expect.any(Object));
    await expect(store.getToken()).resolves.toBeNull();
    await expect(createSecureTokenStore().getToken()).resolves.toBeNull();
  });

  it('applies writes in order (a renewal then a logout ends logged out)', async () => {
    const store = createSecureTokenStore();
    await Promise.all([store.setToken('renewed'), store.clearToken()]);
    await expect(createSecureTokenStore().getToken()).resolves.toBeNull();
  });
});
