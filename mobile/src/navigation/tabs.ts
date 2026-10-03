import { House, Key, ShoppingBag, Sparkles, Users, type LucideIcon } from 'lucide-react-native';

import type { ColorToken } from '../theme/colors';

/** The modules that own a tab and an accent (design system sections 1 and 10). */
export type Module = 'home' | 'events' | 'community' | 'market' | 'travel';

export type TabDefinition = {
  /** Route name in src/app/(tabs). */
  route: 'index' | 'events' | 'community' | 'market' | 'travel';
  module: Module;
  icon: LucideIcon;
  labelKey: `tabs.${Module}`;
};

/** Fixed order (design system section 10). */
export const TABS: readonly TabDefinition[] = [
  { route: 'index', module: 'home', icon: House, labelKey: 'tabs.home' },
  { route: 'events', module: 'events', icon: Sparkles, labelKey: 'tabs.events' },
  { route: 'community', module: 'community', icon: Users, labelKey: 'tabs.community' },
  { route: 'market', module: 'market', icon: ShoppingBag, labelKey: 'tabs.market' },
  { route: 'travel', module: 'travel', icon: Key, labelKey: 'tabs.travel' },
];

/**
 * Module accents. Class names are written out in full so Tailwind finds them.
 * Active tab: module Base fill + Ink icon and label. Inactive: module Dark.
 */
export const MODULE_ACCENT: Record<
  Module,
  { activeBg: string; inactiveText: string; inactiveIcon: ColorToken }
> = {
  home: {
    activeBg: 'bg-lavender',
    inactiveText: 'text-lavender-dark',
    inactiveIcon: 'lavender-dark',
  },
  events: { activeBg: 'bg-green', inactiveText: 'text-green-dark', inactiveIcon: 'green-dark' },
  community: { activeBg: 'bg-sky', inactiveText: 'text-sky-dark', inactiveIcon: 'sky-dark' },
  market: { activeBg: 'bg-pink', inactiveText: 'text-pink-dark', inactiveIcon: 'pink-dark' },
  travel: { activeBg: 'bg-sunny', inactiveText: 'text-sunny-dark', inactiveIcon: 'sunny-dark' },
};
