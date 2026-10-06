import * as SecureStore from 'expo-secure-store';

// The search areas chosen on the Sorties tab (AC-3.3, design E1c multi-select), remembered on
// the device. Tiny non-secret values (area keys such as "paris-11", never a position) kept in
// secure storage to avoid another package, like the language (localeStore). No key, or an
// empty list, is "Tout Paris" (the default, PM decision 2026-10-06).
export const AREA_KEY = 'sparkcircles.events.area';
const RADIUS_KEY = 'sparkcircles.events.radius';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export type StoredArea = { areas: string[]; radius: number };

/** "paris-11,paris-20" (a single "paris-11" from before multi-select reads the same). */
const parse = (value: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

export async function readArea(): Promise<StoredArea> {
  try {
    const [areas, radius] = await Promise.all([
      SecureStore.getItemAsync(AREA_KEY, OPTIONS),
      SecureStore.getItemAsync(RADIUS_KEY, OPTIONS),
    ]);
    return { areas: parse(areas), radius: Number(radius) || 0 };
  } catch {
    return { areas: [], radius: 0 };
  }
}

export async function saveArea({ areas, radius }: StoredArea): Promise<void> {
  try {
    await SecureStore.setItemAsync(AREA_KEY, areas.join(','), OPTIONS);
    await SecureStore.setItemAsync(RADIUS_KEY, String(radius), OPTIONS);
  } catch {
    // Kept for this session only.
  }
}
