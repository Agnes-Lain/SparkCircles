import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';

import type { EventOptions } from '../../api/events';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { Skeleton } from '../../components/Skeleton';

type Areas = EventOptions['areas'];

/** Lower-case without accents, to match "paris 11" with "Paris 11e". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** "Paris 11e" → "11e" (the second and later names in the chip summary). */
const short = (area: Areas[number]) =>
  area.label.startsWith(`${area.city} `) ? area.label.slice(area.city.length + 1) : area.label;

/**
 * E1c area chip summary: "Tout Paris", "Paris 11e", "Paris 11e, 20e" (2 max), then
 * "3 arrondissements"; the spoken label always reads the full list
 * ("Zone : Paris 11e, 12e, 20e. Modifier la zone").
 */
export function areaSummary(
  keys: string[],
  areas: Areas | undefined,
  t: TFunction,
): { label: string; a11y: string } {
  // Areas in the list order (1er to 20e), whatever order they were ticked in.
  const chosen = (areas ?? []).filter((area) => keys.includes(area.key));
  if (!chosen.length) {
    const all = t('events.area.all');
    return { label: all, a11y: t('events.area.chipA11y', { areas: all }) };
  }
  const list = [chosen[0]!.label, ...chosen.slice(1).map(short)].join(', ');
  const label = chosen.length <= 2 ? list : t('events.area.summaryMany', { count: chosen.length });
  return { label, a11y: t('events.area.chipA11y', { areas: list }) };
}

/**
 * E1c Choose areas (AC-3.3, PM decision 2026-10-06): a multi-select sheet. "Tout Paris" is
 * ticked when no arrondissement is; ticking it clears them; unticking the last one goes back
 * to it. Sticky "Effacer" (back to "Tout Paris") and "Voir les sorties". No GPS.
 *
 * Mounted afresh each time it opens (the parent changes its `key`), so it starts from the
 * current choice.
 */
export function AreaSheet({
  visible,
  areas,
  current,
  guest = false,
  onApply,
  onClose,
}: {
  visible: boolean;
  areas: Areas | undefined;
  current: string[];
  /** Guest wording (design guest-home section 4): the choice stays on this phone (AC-15.9). */
  guest?: boolean;
  onApply: (areas: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(current);
  // "2 arrondissements sélectionnés", "Tout Paris", "Sélection effacée, tout Paris".
  const announce = (text: string) => AccessibilityInfo.announceForAccessibility(text);
  const choose = (next: string[]) => {
    setSelected(next);
    announce(
      next.length ? t('events.area.selected', { count: next.length }) : t('events.area.all'),
    );
  };
  const toggle = (key: string) =>
    choose(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  const clear = () => {
    setSelected([]);
    announce(t('events.area.cleared'));
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="area-sheet">
      <View className="gap-xs">
        <Text accessibilityRole="header" className="text-h2 text-ink">
          {guest ? t('guest.area.title') : t('events.area.sheetTitle')}
        </Text>
        {guest ? null : <Text className="text-body text-ink-2">{t('events.area.sheetBody')}</Text>}
      </View>
      <ScrollView style={{ maxHeight: 320 }}>
        <View role="group" accessibilityLabel={t('events.area.group')}>
          <Checkbox
            label={t('events.area.all')}
            accessibilityLabel={t('events.area.all')}
            checked={selected.length === 0}
            onChange={() => choose([])}
            testID="area-all"
          />
          {areas
            ? areas.map((area) => (
                <Checkbox
                  key={area.key}
                  label={area.label}
                  accessibilityLabel={area.label}
                  checked={selected.includes(area.key)}
                  onChange={() => toggle(area.key)}
                  testID={`area-${area.key}`}
                />
              ))
            : [0, 1, 2].map((i) => (
                <View key={i} className="py-md">
                  <Skeleton width="50%" height={14} />
                </View>
              ))}
        </View>
      </ScrollView>
      {guest ? <Text className="text-caption text-ink-2">{t('guest.area.caption')}</Text> : null}
      <View className="gap-sm border-t-[0.5px] border-border-soft pt-md">
        {selected.length ? (
          <Text className="text-caption text-ink-2" testID="area-count">
            {t('events.area.selected', { count: selected.length })}
          </Text>
        ) : null}
        <View className="flex-row gap-sm">
          <View className="flex-1">
            <Button
              variant="ghost"
              label={t('events.area.clear')}
              onPress={clear}
              testID="area-clear"
            />
          </View>
          <View className="flex-[1.6]">
            <Button
              label={t('events.area.see')}
              onPress={() => onApply(selected)}
              testID="area-use"
            />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
