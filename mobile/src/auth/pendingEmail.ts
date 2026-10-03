import { useSyncExternalStore } from 'react';

// The email typed at sign-up, kept in memory only (never stored, never in a route param or
// URL, AC-10.6) so Check your inbox can show it masked and send the link again before the
// account has a session on this device.
let email: string | null = null;
const listeners = new Set<() => void>();

export function setPendingEmail(value: string | null): void {
  email = value;
  listeners.forEach((listener) => listener());
}

export function usePendingEmail(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => email,
  );
}

/** "claire@gmail.com" → "c•••••@gmail.com" (design S3): the address is partly masked on screen. */
export function maskEmail(value: string): string {
  const at = value.lastIndexOf('@');
  if (at < 1) return value;
  return `${value[0]}•••••${value.slice(at)}`;
}
