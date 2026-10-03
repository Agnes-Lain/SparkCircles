import { CircleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Icon } from './Icon';

export type NotificationLevel = 'recommendation' | 'community' | 'reminder' | 'confirmed' | 'error';

export type NotificationProps = {
  level: NotificationLevel;
  title: string;
  caption?: string;
  /** Optional action, e.g. a Small Secondary "Try again" button on errors. */
  action?: ReactNode;
  testID?: string;
};

// Tinted card + colored dot, caption in the accent's Dark (design system section 9).
const LEVEL: Record<NotificationLevel, { bg: string; dot: string; caption: string }> = {
  recommendation: {
    bg: 'bg-lavender-light',
    dot: 'bg-lavender-dark',
    caption: 'text-lavender-dark',
  },
  community: { bg: 'bg-sky-light', dot: 'bg-sky-dark', caption: 'text-sky-dark' },
  reminder: { bg: 'bg-sunny-light', dot: 'bg-sunny-dark', caption: 'text-sunny-dark' },
  confirmed: { bg: 'bg-green-light', dot: 'bg-green-dark', caption: 'text-green-dark' },
  error: { bg: 'bg-error-light', dot: '', caption: 'text-error-dark' },
};

/**
 * Notification card (design system section 9). Error replaces the dot with an
 * alert-circle icon and is announced to screen readers; color is never the only signal.
 */
export function Notification({ level, title, caption, action, testID }: NotificationProps) {
  const style = LEVEL[level];
  const isError = level === 'error';
  return (
    <View testID={testID} className={`rounded-lg px-lg py-md ${style.bg}`}>
      {/* Title and caption are read together; the action stays a separate control. */}
      <View
        accessible
        accessibilityRole={isError ? 'alert' : 'text'}
        accessibilityLiveRegion={isError ? 'polite' : 'none'}
        className="flex-row items-start"
      >
        <View className="mr-sm mt-0.5">
          {isError ? (
            <Icon icon={CircleAlert} size={16} color="error-dark" />
          ) : (
            <View className={`mt-1 h-2 w-2 rounded-full ${style.dot}`} />
          )}
        </View>
        <View className="flex-1">
          {/* Title 13px/500 Ink: specified in section 9, not a section 15 token. */}
          <Text className="text-[13px] font-medium text-ink">{title}</Text>
          {caption ? <Text className={`text-caption ${style.caption}`}>{caption}</Text> : null}
        </View>
      </View>
      {action ? <View className="mt-sm items-start">{action}</View> : null}
    </View>
  );
}
