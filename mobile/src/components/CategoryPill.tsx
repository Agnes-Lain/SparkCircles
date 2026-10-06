import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { ColorToken } from '../theme/colors';
import { FilterChip } from './FilterChip';
import { Icon } from './Icon';

/** Event category keys (fixed list of the Events API contract). */
export type CategoryKey =
  | 'sport'
  | 'music'
  | 'outdoors'
  | 'playdates'
  | 'board_games'
  | 'books'
  | 'video_games'
  | 'shows'
  | 'crafts'
  | 'workshops'
  | 'other';

type Tone = { circle: string; icon: ColorToken };

// Category colour table (design system v1.6, section 6): icon in Dark on the Light shade.
// Class names are written out in full so Tailwind finds them.
const SKY: Tone = { circle: 'bg-sky-light', icon: 'sky-dark' };
const MINT: Tone = { circle: 'bg-green-light', icon: 'green-dark' };
const LAVENDER: Tone = { circle: 'bg-lavender-light', icon: 'lavender-dark' };
const PINK: Tone = { circle: 'bg-pink-light', icon: 'pink-dark' };
const SUNNY: Tone = { circle: 'bg-sunny-light', icon: 'sunny-dark' };
const OTHER: Tone = { circle: 'bg-other-light', icon: 'ink-2' };

export const CATEGORY_TONE: Record<CategoryKey, Tone> = {
  sport: SKY,
  music: SKY,
  outdoors: MINT,
  playdates: MINT,
  board_games: LAVENDER,
  books: LAVENDER,
  video_games: PINK,
  shows: PINK,
  crafts: SUNNY,
  workshops: SUNNY,
  other: OTHER,
};

/** The 22 px Light-shade circle with the 15 px category icon in Dark, stroke 2. */
export function CategoryIcon({ category, icon }: { category: CategoryKey; icon: LucideIcon }) {
  const tone = CATEGORY_TONE[category];
  return (
    <View
      testID={`category-icon-${category}`}
      className={`h-[22px] w-[22px] items-center justify-center rounded-full ${tone.circle}`}
    >
      <Icon icon={icon} size={15} color={tone.icon} strokeWidth={2} />
    </View>
  );
}

export type CategoryPillProps = {
  category: CategoryKey;
  /** The category name: the colour is decorative, the label always names the category. */
  label: string;
  icon: LucideIcon;
  /** Given: the tappable category filter chip. Omitted: the display pill (event cards). */
  onPress?: () => void;
  selected?: boolean;
  testID?: string;
};

/**
 * Category pill (design system v1.6, section 6). Display variant: Surface, 1 px Ink 3
 * border, radius-full, 13 px/400 Ink label, padding 3/11/3/4, gap 5, not tappable.
 * Interactive variant: the same look as a FilterChip (44 px touch area, selected = mint).
 */
export function CategoryPill({
  category,
  label,
  icon,
  onPress,
  selected = false,
  testID,
}: CategoryPillProps) {
  const circle = <CategoryIcon category={category} icon={icon} />;
  if (onPress) {
    return (
      <FilterChip
        label={label}
        selected={selected}
        onPress={onPress}
        leading={circle}
        testID={testID}
      />
    );
  }
  return (
    <View
      testID={testID}
      className="flex-row items-center gap-[5px] self-start rounded-full border border-border-control bg-surface py-[3px] pl-xs pr-[11px]"
    >
      {circle}
      <Text className="text-[13px] font-normal text-ink">{label}</Text>
    </View>
  );
}
