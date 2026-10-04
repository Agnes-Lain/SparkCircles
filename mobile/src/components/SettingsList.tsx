import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Fragment, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from './Icon';
import { IconSquare } from './IconSquare';

export type SettingsItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** Caption under the label (e.g. "Accepted on 2 Oct 2026, version 1.0"). */
  caption?: string;
  /** Without onPress the row is plain text (no chevron). */
  onPress?: () => void;
  testID?: string;
};

/**
 * Settings list (design system section 7): Surface card, 0/16 padding, rows ≥ 52 px with
 * [icon square] [Body Ink label] [chevron-right Ink 3], 0.5 px separators.
 */
export function SettingsList({ items, title }: { items: SettingsItem[]; title?: string }) {
  return (
    <View className="gap-md">
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <View className="rounded-lg border-[0.5px] border-border-soft bg-surface px-lg">
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 ? <View className="h-[0.5px] bg-border-soft" /> : null}
            <SettingsRow item={item} />
          </Fragment>
        ))}
      </View>
    </View>
  );
}

function SettingsRow({ item }: { item: SettingsItem }) {
  const content = (
    <>
      {item.icon ? <IconSquare icon={item.icon} /> : null}
      <View className="flex-1">
        <Text className="text-body text-ink">{item.label}</Text>
        {item.caption ? <Text className="text-caption text-ink-3">{item.caption}</Text> : null}
      </View>
      {item.onPress ? <Icon icon={ChevronRight} color="ink-3" /> : null}
    </>
  );
  const label = item.caption ? `${item.label}. ${item.caption}` : item.label;
  if (!item.onPress) {
    return (
      <View
        accessible
        accessibilityLabel={label}
        className="min-h-[52px] flex-row items-center gap-md py-sm"
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
      className="min-h-[52px] flex-row items-center gap-md py-sm"
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
