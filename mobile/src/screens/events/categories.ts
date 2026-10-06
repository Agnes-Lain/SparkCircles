import {
  BookOpen,
  Cookie,
  Dices,
  Drama,
  FlaskConical,
  Gamepad2,
  type LucideIcon,
  Music,
  Palette,
  Shapes,
  Trees,
  Volleyball,
} from 'lucide-react-native';

import type { CategoryKey } from '../../components/CategoryPill';

/** The 11 fixed categories in the design's order (design events section 4.4, AC-3.7). */
export const CATEGORIES: readonly CategoryKey[] = [
  'sport',
  'outdoors',
  'board_games',
  'video_games',
  'crafts',
  'music',
  'shows',
  'books',
  'workshops',
  'playdates',
  'other',
];

/** Lucide icon per category (design events section 4.4). */
export const CATEGORY_ICON: Record<CategoryKey, LucideIcon> = {
  sport: Volleyball,
  outdoors: Trees,
  board_games: Dices,
  video_games: Gamepad2,
  crafts: Palette,
  music: Music,
  shows: Drama,
  books: BookOpen,
  workshops: FlaskConical,
  playdates: Cookie,
  other: Shapes,
};
