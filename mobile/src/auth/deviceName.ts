import * as Device from 'expo-device';

/**
 * The phone model ("iPhone 15", "Pixel 8") sent as `device_name` when a device logs in,
 * never the phone's own name, which often holds the owner's first name (M-18).
 */
export function deviceName(): string | null {
  return Device.modelName ?? null;
}
