import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from './Icon';

export type IconSquareTone = 'neutral' | 'verification' | 'sky';

/**
 * Icon square (design system section 7): 32 px, radius-sm, 18 px line icon. Neutral: Shell +
 * Ink 2; verification: green-light + green-dark; sky: sky-light + sky-dark (guest home). `large` is the 44 px version of the sheets.
 */
export function IconSquare({
  icon,
  tone = 'neutral',
  large = false,
}: {
  icon: LucideIcon;
  tone?: IconSquareTone;
  large?: boolean;
}) {
  const box =
    tone === 'verification' ? 'bg-green-light' : tone === 'sky' ? 'bg-sky-light' : 'bg-shell';
  return (
    <View
      className={`items-center justify-center rounded-sm ${box} ${large ? 'h-11 w-11' : 'h-8 w-8'}`}
    >
      <Icon
        icon={icon}
        size={large ? 22 : 18}
        color={tone === 'verification' ? 'green-dark' : tone === 'sky' ? 'sky-dark' : 'ink-2'}
      />
    </View>
  );
}
