import * as SecureStore from 'expo-secure-store';

// The search area chosen once on the Sorties tab (AC-3.3), remembered on the device. A tiny
// non-secret value (an area key such as "paris-11", never a position) kept in secure storage
// to avoid another package, like the language (localeStore).
export const AREA_KEY = 'sparkcircles.events.area';
const RADIUS_KEY = 'sparkcircles.events.radius';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export type StoredArea = { area: string | null; radius: number };

export async function readArea(): Promise<StoredArea> {
  try {
    const [area, radius] = await Promise.all([
      SecureStore.getItemAsync(AREA_KEY, OPTIONS),
      SecureStore.getItemAsync(RADIUS_KEY, OPTIONS),
    ]);
    return { area, radius: Number(radius) || 0 };
  } catch {
    return { area: null, radius: 0 };
  }
}

export async function saveArea({ area, radius }: StoredArea): Promise<void> {
  try {
    if (area) await SecureStore.setItemAsync(AREA_KEY, area, OPTIONS);
    await SecureStore.setItemAsync(RADIUS_KEY, String(radius), OPTIONS);
  } catch {
    // Kept for this session only.
  }
}
