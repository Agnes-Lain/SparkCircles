import Constants from 'expo-constants';
import { uuid } from 'expo-modules-core';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { SECURE_STORE_OPTIONS } from '../auth/tokenStore';

/**
 * App signature headers (Events API contract, "Guest access"): sent on every request,
 * logged in or not, so the API can tell the app from scrapers and rate-limit per device.
 */
export const CLIENT_HEADER = 'X-SparkCircles-Client';
export const DEVICE_HEADER = 'X-SparkCircles-Device';

/** `ios/<app version>` or `android/<app version>`, e.g. `android/1.0.0`. */
export function clientSignature(
  os: string = Platform.OS,
  version: string | undefined = Constants.expoConfig?.version,
): string {
  return `${os}/${version ?? '0.0.0'}`;
}

export const DEVICE_ID_KEY = 'sparkcircles.device.id';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DeviceIdStore = { getDeviceId(): Promise<string> };

/**
 * A random UUID v4 made once per install and kept in expo-secure-store (this device only,
 * never in a backup, not tied to any account). If the secure store fails, the id still
 * works for this launch, kept in memory.
 */
export function createDeviceIdStore(
  store: Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync'> = SecureStore,
  generate: () => string = uuid.v4,
): DeviceIdStore {
  let pending: Promise<string> | undefined;

  async function load(): Promise<string> {
    let existing: string | null = null;
    try {
      existing = await store.getItemAsync(DEVICE_ID_KEY, SECURE_STORE_OPTIONS);
    } catch {
      // Unreadable: make a new one below.
    }
    if (existing && UUID_V4.test(existing)) return existing;
    const id = generate();
    try {
      await store.setItemAsync(DEVICE_ID_KEY, id, SECURE_STORE_OPTIONS);
    } catch {
      // Not saved: this launch keeps it in memory.
    }
    return id;
  }

  return {
    getDeviceId: () => (pending ??= load()),
  };
}

export const secureDeviceIdStore = createDeviceIdStore();
