import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { MODULE_ACCENT, type TabDefinition } from '../navigation/tabs';
import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { shadows } from '../theme/colors';
import { Icon } from './Icon';

export type TabBarProps = {
  tabs: readonly TabDefinition[];
  activeRoute: TabDefinition['route'];
  onTabPress: (route: TabDefinition['route']) => void;
  /** Bottom safe-area inset (home indicator). */
  bottomInset?: number;
};

/**
 * Main tab bar (design system section 10): white container, radius 16, padding 6,
 * 0.5 px border, level-1 shadow. Active tab = module Base fill with Ink icon and label;
 * inactive = module Dark. Labels always visible, icons 20 px stroke 1.8, ≥ 44 px tall.
 */
export function TabBar({ tabs, activeRoute, onTabPress, bottomInset = 0 }: TabBarProps) {
  const { t } = useTranslation();

  return (
    <View className="bg-shell px-lg pt-sm" style={{ paddingBottom: Math.max(bottomInset, 8) }}>
      {/* Not `accessible`: grouping would hide the tabs from screen readers. */}
      <View
        testID="tab-bar"
        accessibilityRole="tablist"
        accessibilityLabel={t('tabs.navigation')}
        className="flex-row rounded-lg border-[0.5px] border-border-soft bg-surface p-1.5"
        style={{ boxShadow: shadows.card }}
      >
        {tabs.map((tab) => {
          const selected = tab.route === activeRoute;
          const accent = MODULE_ACCENT[tab.module];
          const label = t(tab.labelKey);
          return (
            <Pressable
              key={tab.route}
              testID={`tab-${tab.route}`}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => onTabPress(tab.route)}
              className={`flex-1 items-center justify-center rounded-md px-xs py-1.5 ${
                selected ? accent.activeBg : 'bg-transparent'
              }`}
              style={{ minHeight: MIN_TOUCH_TARGET }}
            >
              <Icon icon={tab.icon} size={20} color={selected ? 'ink' : accent.inactiveIcon} />
              {/* Labels grow at most 1.15× with Dynamic Type (design system 10, v1.4.2); the
                  tab's accessibility label keeps the full name for VoiceOver. */}
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.15}
                className={`mt-0.5 text-label tracking-normal ${selected ? 'text-ink' : accent.inactiveText}`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
