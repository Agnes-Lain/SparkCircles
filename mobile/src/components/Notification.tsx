import { CircleAlert } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';

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
 * alert-circle icon and is announced to screen readers when it appears or changes:
 * VoiceOver through announceForAccessibility (iOS has no live regions), TalkBack through
 * the polite live region. Color is never the only signal.
 */
export function Notification({ level, title, caption, action, testID }: NotificationProps) {
  const style = LEVEL[level];
  const isError = level === 'error';

  const announced = useRef<string | null>(null);
  useEffect(() => {
    // Android already speaks the live region below; announcing too would read it twice.
    if (!isError || Platform.OS !== 'ios') return;
    const message = caption ? `${title}. ${caption}` : title;
    if (announced.current === message) return; // once per message, not per render
    announced.current = message;
    AccessibilityInfo.announceForAccessibility(message);
  }, [isError, title, caption]);
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
          <Text className="text-note-title text-ink">{title}</Text>
          {caption ? <Text className={`text-caption ${style.caption}`}>{caption}</Text> : null}
        </View>
      </View>
      {action ? <View className="mt-sm items-start">{action}</View> : null}
    </View>
  );
}
