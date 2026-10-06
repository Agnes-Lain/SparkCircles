import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useMotionAllowed } from '../hooks/useReduceMotion';
import { MODULE_ACCENT, type TabDefinition } from '../navigation/tabs';
import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { colorValue, shadows } from '../theme/colors';
import { RippleSymbol } from './brand/RippleSymbol';
import { Icon } from './Icon';

export type TabBarProps = {
  tabs: readonly TabDefinition[];
  activeRoute: TabDefinition['route'];
  onTabPress: (route: TabDefinition['route']) => void;
  /** Bottom safe-area inset (home indicator). */
  bottomInset?: number;
};

/** Raised centre button (option B2, section 10): 60 px disc, 58 px symbol, top −36 px. */
const DISC_SIZE = 60;
const SYMBOL_SIZE = 58;
const DISC_TOP = -36;
/** Same size as a line icon: keeps the centre label on the other labels' line. */
const ICON_SIZE = 20;
/**
 * "Mon espace" (about 62 pt, 71 pt at 1.15×) is wider than a slot: the approved v1.7
 * exception lets it overflow into the neighbours' padding, never wrap or truncate.
 */
const CENTRE_LABEL_WIDTH = 76;

/**
 * Main tab bar (design system v1.7, section 10): white container floating on the shell
 * gradient, radius 16, padding 6, 0.5 px border, level-1 shadow. Active tab = module Base
 * fill with Ink icon and label; inactive = module Dark. Labels always visible, icons 20 px
 * stroke 1.8, ≥ 44 px tall. The centre slot is the raised My space button.
 */
export function TabBar({ tabs, activeRoute, onTabPress, bottomInset = 0 }: TabBarProps) {
  const { t } = useTranslation();

  return (
    <View className="px-lg pt-sm" style={{ paddingBottom: Math.max(bottomInset, 8) }}>
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
          const label = t(tab.labelKey);
          const press = () => onTabPress(tab.route);
          if (!tab.icon) {
            return (
              <CentreTab
                key={tab.route}
                tab={tab}
                label={label}
                selected={selected}
                onPress={press}
              />
            );
          }
          const accent = MODULE_ACCENT[tab.module];
          return (
            <Pressable
              key={tab.route}
              testID={`tab-${tab.route}`}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={press}
              className={`flex-1 items-center justify-center rounded-md px-xs py-1.5 ${
                selected ? accent.activeBg : 'bg-transparent'
              }`}
              style={{ minHeight: MIN_TOUCH_TARGET }}
            >
              <Icon
                icon={tab.icon}
                size={ICON_SIZE}
                color={selected ? 'ink' : accent.inactiveIcon}
              />
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

/**
 * My space (B2): a white disc with the full-colour Ripple symbol floats above the bar; an
 * invisible 20 px placeholder keeps the label on the shared line. Selected = 3 px Lavender
 * Base ring + Ink label (no slot fill); unselected = Lavender Dark label. The disc and the
 * label are one pressable. Pressed: scale 0.96, none under reduced motion.
 */
function CentreTab({
  tab,
  label,
  selected,
  onPress,
}: {
  tab: TabDefinition;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const motionAllowed = useMotionAllowed();
  const [pressed, setPressed] = useState(false);
  const accent = MODULE_ACCENT[tab.module];
  const ring = `0 0 0 3px ${colorValue('lavender')}, ${shadows.fab}`;

  return (
    <Pressable
      testID={`tab-${tab.route}`}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      // The disc rises above the bar: extend the touch area upwards so a tap on its top counts.
      hitSlop={{ top: 36 }}
      className="flex-1 items-center justify-center bg-transparent px-xs py-1.5"
      style={{ minHeight: MIN_TOUCH_TARGET, minWidth: DISC_SIZE, overflow: 'visible' }}
    >
      <View
        testID="my-space-disc"
        className="absolute items-center justify-center rounded-full border border-border-soft bg-surface"
        style={{
          top: DISC_TOP,
          left: '50%',
          marginLeft: -DISC_SIZE / 2,
          width: DISC_SIZE,
          height: DISC_SIZE,
          boxShadow: selected ? ring : shadows.fab,
          transform: [{ scale: pressed && motionAllowed ? 0.96 : 1 }],
        }}
      >
        <RippleSymbol size={SYMBOL_SIZE} testID="my-space-symbol" />
      </View>
      <View testID="my-space-placeholder" style={{ width: ICON_SIZE, height: ICON_SIZE }} />
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.15}
        className={`mt-0.5 text-center text-label tracking-normal ${
          selected ? 'text-ink' : accent.inactiveText
        }`}
        style={{ width: CENTRE_LABEL_WIDTH }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
