import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Fragment, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge, type BadgeKind } from './Badge';
import { Icon } from './Icon';
import { IconSquare, type IconSquareTone } from './IconSquare';

export type SettingsItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** Icon square tone (neutral by default). */
  iconTone?: IconSquareTone;
  /** Caption under the label (e.g. "Accepted on 2 Oct 2026, version 1.0"). */
  caption?: string;
  /** « Changement à confirmer » (design my-space 3): the caption in Sunny Dark. */
  captionTone?: 'default' | 'attention';
  /** Without onPress the row is plain text (no chevron). */
  onPress?: () => void;
  /** A badge after the label (a count, « Bientôt »). */
  badge?: { label: string; kind: BadgeKind };
  /** What screen readers say instead of "label. caption". */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Settings list (design system section 7): Surface card, 0/16 padding, rows ≥ 52 px with
 * [icon square] [Body Ink label] [chevron-right Ink 3], 0.5 px separators.
 */
export function SettingsList({
  items,
  title,
  roomy = false,
  testID,
}: {
  items: SettingsItem[];
  title?: string;
  /** 56 px rows (the circle toolbox) instead of 52. */
  roomy?: boolean;
  testID?: string;
}) {
  return (
    <View className="gap-md" testID={testID}>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <View className="rounded-lg border-[0.5px] border-border-soft bg-surface px-lg">
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 ? <View className="h-[0.5px] bg-border-soft" /> : null}
            <SettingsRow item={item} roomy={roomy} />
          </Fragment>
        ))}
      </View>
    </View>
  );
}

function SettingsRow({ item, roomy }: { item: SettingsItem; roomy: boolean }) {
  const row = `${roomy ? 'min-h-[56px]' : 'min-h-[52px]'} flex-row items-center gap-md py-sm`;
  const content = (
    <>
      {item.icon ? <IconSquare icon={item.icon} tone={item.iconTone} /> : null}
      <View className="flex-1">
        <Text className="text-body text-ink">{item.label}</Text>
        {item.caption ? (
          <Text
            className={`text-caption ${item.captionTone === 'attention' ? 'text-sunny-dark' : 'text-ink-3'}`}
          >
            {item.caption}
          </Text>
        ) : null}
      </View>
      {item.badge ? (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Badge kind={item.badge.kind} label={item.badge.label} />
        </View>
      ) : null}
      {item.onPress ? <Icon icon={ChevronRight} color="ink-3" /> : null}
    </>
  );
  const label =
    item.accessibilityLabel ?? (item.caption ? `${item.label}. ${item.caption}` : item.label);
  if (!item.onPress) {
    return (
      <View
        testID={item.testID}
        accessible
        accessibilityRole="text"
        accessibilityLabel={label}
        className={row}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={item.testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={item.onPress}
      className={row}
    >
      {content}
    </Pressable>
  );
}

/** Section label (Label style, Ink 2, uppercase in the mockups). */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" className="text-label uppercase text-ink-2">
      {children}
    </Text>
  );
}
