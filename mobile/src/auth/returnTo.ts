import type { Href } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import type { AgeBand, EventLanguage } from '../api/events';
import type { CategoryKey } from '../components/CategoryPill';
import { SECURE_STORE_OPTIONS } from './tokenStore';

/**
 * AC-15.7, AC-15.8: where a guest goes back to after signing up (email confirmation included)
 * or logging in: the event they were on, or the Sorties search with its filters, or the tab
 * they were on. Kept on this device only (the email link may reopen the app later), never
 * sent to the server, and forgotten after a day.
 */
export type SavedFilters = {
  categories: CategoryKey[];
  date: { mode: 'today' | 'weekend' } | { mode: 'pick'; date: string } | null;
  ageBand: AgeBand | null;
  tag: string;
  language: EventLanguage | null;
  text: string;
};

export type ReturnAction = 'join' | 'verify' | 'report' | 'wishlist';

export type ReturnTarget = {
  /**
   * The event the guest was on, and what they wanted: join, (verified-only) verify, report,
   * or wishlist (the heart isn't built yet: back to the event, nothing more).
   */
  event?: { id: string; then: ReturnAction };
  /** « Créer ma sortie »: the create form (V0 replaces it until the account is verified). */
  create?: boolean;
  /** Circles AC-17.6: a public circle's page, the request ready but not sent. */
  circle?: { id: string };
  /** Circles AC-3.3: an invitation link, the request ready but not sent. */
  invitation?: { token: string };
  /** A guest tab (Cercles, Services, Voyages, Mon espace). */
  tab?: 'community' | 'market' | 'travel' | 'my-space';
  /** The Sorties search as it was (the area is already kept on the device, areaStore). */
  filters?: SavedFilters | null;
};

export const RETURN_TO_KEY = 'sparkcircles.guest.returnTo';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Stored = ReturnTarget & { savedAt: number };

let cached: Stored | null = null;
// The Sorties filters the guest is using right now (DiscoverList keeps this up to date).
let currentFilters: SavedFilters | null = null;
// Filters restored after the account step, taken once by the Sorties list.
let pendingFilters: SavedFilters | null = null;

export function rememberFilters(filters: SavedFilters | null) {
  currentFilters = filters;
}

/** Saves where to come back to, with the current Sorties filters. */
export async function saveReturnTo(target: ReturnTarget): Promise<void> {
  cached = { filters: currentFilters, ...target, savedAt: Date.now() };
  try {
    await SecureStore.setItemAsync(RETURN_TO_KEY, JSON.stringify(cached), SECURE_STORE_OPTIONS);
  } catch {
    // Kept in memory for this launch.
  }
}

/** Reads the saved target at launch (the email link may open a fresh app). */
export async function loadReturnTo(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(RETURN_TO_KEY, SECURE_STORE_OPTIONS);
    const parsed = raw ? (JSON.parse(raw) as Stored) : null;
    cached = parsed && typeof parsed.savedAt === 'number' ? parsed : null;
  } catch {
    cached = null;
  }
}

/** The target, once: it is forgotten as soon as it is used (or when it is too old). */
export function consumeReturnTo(now: number = Date.now()): ReturnTarget | null {
  const target = cached;
  cached = null;
  void SecureStore.deleteItemAsync(RETURN_TO_KEY, SECURE_STORE_OPTIONS).catch(() => undefined);
  if (!target || now - target.savedAt > MAX_AGE_MS) return null;
  pendingFilters = target.filters ?? null;
  return target;
}

/** The filters to restore on the Sorties list, once. */
export function takeRestoredFilters(): SavedFilters | null {
  const filters = pendingFilters;
  pendingFilters = null;
  return filters;
}

/**
 * Where the target leads: the event (its action ready, not done), the create form, a circle
 * or an invitation (the request ready, not sent), a tab, or Sorties.
 */
export function returnHref(target: ReturnTarget): Href {
  if (target.create) return '/events/new';
  if (target.event)
    return `/events/${encodeURIComponent(target.event.id)}?then=${target.event.then}`;
  if (target.circle) return `/circles/${encodeURIComponent(target.circle.id)}?then=request`;
  if (target.invitation) return `/join/${encodeURIComponent(target.invitation.token)}?then=request`;
  if (target.tab) return `/${target.tab}`;
  return '/';
}
