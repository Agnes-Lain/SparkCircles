import { createContext, useContext } from 'react';

import type { GateState } from './gate';

export const GateContext = createContext<GateState>('loading');

/** The auth gate's current state (set by the root layout). */
export function useGate(): GateState {
  return useContext(GateContext);
}

/** Guest mode (US-15): no session on this device. */
export function useIsGuest(): boolean {
  return useGate() === 'signedOut';
}
