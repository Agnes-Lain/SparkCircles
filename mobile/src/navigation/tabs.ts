import { Key, ShoppingBag, Sparkles, Users, type LucideIcon } from 'lucide-react-native';

import type { ColorToken } from '../theme/colors';

/** The modules that own a tab and an accent (design system sections 1 and 10). */
export type Module = 'events' | 'community' | 'mySpace' | 'market' | 'travel';

export type TabDefinition = {
  /**
   * Route name in src/app/(tabs). Sorties is `index`: the default landing tab (v1.7,
   * section 17), so `/` opens on it.
   */
  route: 'index' | 'community' | 'my-space' | 'market' | 'travel';
  module: Module;
  /** Line icon; `null` for the raised centre button, which shows the Ripple symbol. */
  icon: LucideIcon | null;
  labelKey: `tabs.${Module}`;
};

/** Fixed order, My space raised in the centre (design system v1.7, section 10). */
export const TABS: readonly TabDefinition[] = [
  { route: 'index', module: 'events', icon: Sparkles, labelKey: 'tabs.events' },
  { route: 'community', module: 'community', icon: Users, labelKey: 'tabs.community' },
  { route: 'my-space', module: 'mySpace', icon: null, labelKey: 'tabs.mySpace' },
  { route: 'market', module: 'market', icon: ShoppingBag, labelKey: 'tabs.market' },
  { route: 'travel', module: 'travel', icon: Key, labelKey: 'tabs.travel' },
];

/**
 * Module accents. Class names are written out in full so Tailwind finds them.
 * Active tab: module Base fill + Ink icon and label. Inactive: module Dark. (My space has
 * no fill: its selected state is a Lavender Base ring around the raised disc.)
 */
export const MODULE_ACCENT: Record<
  Module,
  { activeBg: string; inactiveText: string; inactiveIcon: ColorToken }
> = {
  events: { activeBg: 'bg-green', inactiveText: 'text-green-dark', inactiveIcon: 'green-dark' },
  community: { activeBg: 'bg-sky', inactiveText: 'text-sky-dark', inactiveIcon: 'sky-dark' },
  mySpace: {
    activeBg: 'bg-lavender',
    inactiveText: 'text-lavender-dark',
    inactiveIcon: 'lavender-dark',
  },
  market: { activeBg: 'bg-pink', inactiveText: 'text-pink-dark', inactiveIcon: 'pink-dark' },
  travel: { activeBg: 'bg-sunny', inactiveText: 'text-sunny-dark', inactiveIcon: 'sunny-dark' },
};
