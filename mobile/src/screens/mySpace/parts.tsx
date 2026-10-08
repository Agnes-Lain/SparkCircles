import { CircleAlert, type LucideIcon, RefreshCw, WifiOff } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { Skeleton } from '../../components/Skeleton';
import { TextLink } from '../../components/TextLink';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { shadows } from '../../theme/colors';

/** H2 of a Today block, with an optional link at the right (« Tout voir », « Tous »). */
export function BlockHeading({
  title,
  link,
}: {
  title: string;
  link?: { label: string; onPress: () => void; testID?: string };
}) {
  return (
    <View className="flex-row items-center justify-between gap-md">
      <Text accessibilityRole="header" className="flex-1 text-h2 text-ink">
        {title}
      </Text>
      {link ? <TextLink label={link.label} onPress={link.onPress} testID={link.testID} /> : null}
    </View>
  );
}

/** Surface card of the Today blocks. */
export function Card({
  children,
  testID,
  className = '',
}: {
  children: ReactNode;
  testID?: string;
  /** Extra layout classes (the full Agenda card fills the screen: `flex-1`). */
  className?: string;
}) {
  return (
    <View
      testID={testID}
      className={`rounded-lg border-[0.5px] border-border-soft bg-surface ${className}`}
      style={{ boxShadow: shadows.card }}
    >
      {children}
    </View>
  );
}

/**
 * Block error (design 4.3): replaces only that block's content; « Réessayer » in Error Dark.
 * `announce` makes it the one alert of a failure group (not one per block).
 */
export function BlockError({
  onRetry,
  announce = false,
  testID,
}: {
  onRetry: () => void;
  announce?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <View testID={testID} className="gap-xs rounded-lg bg-error-light px-lg py-md">
      <View
        accessible
        accessibilityRole={announce ? 'alert' : 'text'}
        accessibilityLiveRegion={announce ? 'polite' : 'none'}
        className="flex-row items-center gap-sm"
      >
        <Icon icon={CircleAlert} size={16} color="error-dark" />
        <Text className="flex-1 text-body text-ink">{t('mySpace.error.block')}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mySpace.error.retry')}
        onPress={onRetry}
        className="flex-row items-center gap-xs self-start"
        style={{ minHeight: MIN_TOUCH_TARGET }}
        testID={testID ? `${testID}-retry` : undefined}
      >
        <Icon icon={RefreshCw} size={16} color="error-dark" />
        <Text className="text-body font-medium text-error-dark underline">
          {t('mySpace.error.retry')}
        </Text>
      </Pressable>
    </View>
  );
}

/** Block skeleton (design 4.2): H2 bar, then a card with 3 lines; hidden from screen readers. */
export function BlockSkeleton({ strip = false, testID }: { strip?: boolean; testID?: string }) {
  return (
    <View
      testID={testID}
      className="gap-md"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Skeleton width="40%" height={20} />
      <Card>
        <View className="gap-sm p-lg">
          {strip ? (
            <View className="mb-sm flex-row justify-between">
              {[0, 1, 2, 3, 4, 5, 6].map((cell) => (
                <Skeleton key={cell} width={36} height={52} />
              ))}
            </View>
          ) : null}
          <Skeleton width="30%" height={16} />
          <Skeleton width="80%" height={20} />
          <Skeleton width="60%" height={14} />
        </View>
      </Card>
    </View>
  );
}

/** Ghost box (design 4.1, partial emptiness): dashed 1.5 px, one line and one link. */
export function GhostBox({
  icon,
  text,
  link,
  testID,
}: {
  icon?: LucideIcon;
  text: string;
  link: { label: string; onPress: () => void };
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      className="items-center gap-xs rounded-lg border-[1.5px] border-dashed border-ink-3 px-lg py-md"
    >
      {icon ? <Icon icon={icon} size={20} color="ink-2" /> : null}
      <Text className="text-center text-body text-ink-2">{text}</Text>
      <TextLink label={link.label} onPress={link.onPress} />
    </View>
  );
}

/** Offline banner (design 4.3): sky-light, « Pas de connexion » and when Today was loaded. */
export function OfflineBanner({ time }: { time: string | null }) {
  const { t } = useTranslation();
  return (
    <View
      testID="my-space-offline"
      accessible
      accessibilityRole="alert"
      className="flex-row items-start gap-sm rounded-lg bg-sky-light px-lg py-md"
    >
      <Icon icon={WifiOff} size={18} color="sky-dark" />
      <View className="flex-1">
        <Text className="text-note-title text-ink">{t('mySpace.offline.title')}</Text>
        {time ? (
          <Text className="text-caption text-sky-dark">{t('mySpace.offline.body', { time })}</Text>
        ) : null}
      </View>
    </View>
  );
}
