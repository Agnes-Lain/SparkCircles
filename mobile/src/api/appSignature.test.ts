import * as SecureStore from 'expo-secure-store';

import { SECURE_STORE_OPTIONS } from '../auth/tokenStore';
import { clientSignature, createDeviceIdStore, DEVICE_ID_KEY } from './appSignature';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const secureStore = SecureStore as typeof SecureStore & { __reset: () => void };

describe('app signature (Events API contract, guest access headers)', () => {
  beforeEach(() => secureStore.__reset());

  it('signs as ios/<app version> or android/<app version>', () => {
    expect(clientSignature('ios', '1.2.0')).toBe('ios/1.2.0');
    expect(clientSignature('android', '1.0.0')).toBe('android/1.0.0');
  });

  it('reads the app version from the Expo config by default', () => {
    expect(clientSignature('ios')).toMatch(/^ios\/\d+\.\d+\.\d+$/);
  });

  it('makes a UUID v4 once per install and keeps it in the secure store', async () => {
    const generate = jest.fn(() => '3b241101-e2bb-4255-8caf-4136c566a962');
    const first = createDeviceIdStore(SecureStore, generate);

    const id = await first.getDeviceId();
    expect(id).toMatch(UUID_V4);
    expect(await first.getDeviceId()).toBe(id);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(DEVICE_ID_KEY, id, SECURE_STORE_OPTIONS);

    // Next launch: the same id, nothing new generated.
    const relaunched = createDeviceIdStore(SecureStore, generate);
    expect(await relaunched.getDeviceId()).toBe(id);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('generates a real random UUID v4 by default', async () => {
    const id = await createDeviceIdStore().getDeviceId();
    expect(id).toMatch(UUID_V4);
  });

  it('replaces a stored value that is not a UUID v4', async () => {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, 'not-a-uuid');
    const store = createDeviceIdStore(SecureStore, () => '9c5b94b1-35ad-49bb-b118-8e8fc24abf80');
    expect(await store.getDeviceId()).toBe('9c5b94b1-35ad-49bb-b118-8e8fc24abf80');
  });

  it('still gives an id for this launch when the secure store fails', async () => {
    const broken = {
      getItemAsync: jest.fn().mockRejectedValue(new Error('keychain')),
      setItemAsync: jest.fn().mockRejectedValue(new Error('keychain')),
    };
    const store = createDeviceIdStore(broken, () => '9c5b94b1-35ad-49bb-b118-8e8fc24abf80');
    expect(await store.getDeviceId()).toBe('9c5b94b1-35ad-49bb-b118-8e8fc24abf80');
  });
});
