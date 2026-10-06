import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { AgeBand, EventLanguage } from '../../api/events';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { FilterChip } from '../../components/FilterChip';
import { SectionLabel } from '../../components/SettingsList';
import { TextField } from '../../components/TextField';
import { TextLink } from '../../components/TextLink';

/**
 * The radius choices. The contract allows 0 to 10 km (`radius_km`), so the design's 20 km
 * chip is left out (reported to the PM).
 */
export const RADIUS_CHOICES = [2, 5, 10] as const;
const AGE_BANDS: AgeBand[] = ['0-2', '3-5', '6-8', '9-12', '13+'];

export type SheetFilters = {
  radius: number;
  ageBand: AgeBand | null;
  tag: string;
  /** AC-16.3: null = every language ("Toutes", the default). */
  language: EventLanguage | null;
};
const LANGUAGES: EventLanguage[] = ['fr', 'en'];

/** "#Foot " → "foot" (the API normalises the same way). */
export function normaliseTag(text: string): string {
  return text.trim().replace(/^#+/, '').toLowerCase();
}

/** E1d Filters (AC-3.2): distance, child age, tag, language (AC-16.3). Applied with the Primary. The distance
 *  is offered only from chosen arrondissements ("Tout Paris" has no centre). */
export function FiltersSheet({
  visible,
  value,
  withDistance = true,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: SheetFilters;
  withDistance?: boolean;
  onApply: (filters: SheetFilters) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  // Mounted afresh on each opening (the parent changes its `key`): starts from `value`.

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="filters-sheet">
      <Text accessibilityRole="header" className="text-h2 text-ink">
        {t('events.filters.button')}
      </Text>
      {withDistance ? (
        <View className="gap-sm">
          <SectionLabel>{t('events.filters.distance')}</SectionLabel>
          <View className="flex-row flex-wrap gap-sm">
            {RADIUS_CHOICES.map((km) => (
              <FilterChip
                key={km}
                label={t('events.filters.km', { count: km })}
                selected={draft.radius === km}
                onPress={() => setDraft((d) => ({ ...d, radius: d.radius === km ? 0 : km }))}
                testID={`radius-${km}`}
              />
            ))}
          </View>
        </View>
      ) : null}
      <View className="gap-sm">
        <SectionLabel>{t('events.filters.age')}</SectionLabel>
        <View className="flex-row flex-wrap gap-sm">
          {AGE_BANDS.map((band) => (
            <FilterChip
              key={band}
              label={t(`events.filters.ageBands.${band}`)}
              selected={draft.ageBand === band}
              onPress={() => setDraft((d) => ({ ...d, ageBand: d.ageBand === band ? null : band }))}
              testID={`age-${band}`}
            />
          ))}
        </View>
      </View>
      <View className="gap-sm">
        <SectionLabel>{t('events.language.filter')}</SectionLabel>
        <View
          className="flex-row flex-wrap gap-sm"
          accessibilityLabel={t('events.language.filter')}
          testID="language-filter"
        >
          <FilterChip
            label={t('events.language.all')}
            selected={draft.language === null}
            onPress={() => setDraft((d) => ({ ...d, language: null }))}
            testID="language-all"
          />
          {LANGUAGES.map((language) => (
            <FilterChip
              key={language}
              label={t(`events.language.${language}`)}
              selected={draft.language === language}
              onPress={() =>
                setDraft((d) => ({ ...d, language: d.language === language ? null : language }))
              }
              testID={`language-${language}`}
            />
          ))}
        </View>
      </View>
      <TextField
        label={t('events.filters.tag')}
        value={draft.tag}
        onChangeText={(tag) => setDraft((d) => ({ ...d, tag }))}
        leading={<Text className="text-body text-ink-2">#</Text>}
        testID="filter-tag"
      />
      <View className="items-center gap-xs">
        <View className="self-stretch">
          <Button
            size="large"
            label={t('events.filters.show')}
            onPress={() => onApply({ ...draft, tag: normaliseTag(draft.tag) })}
            testID="filters-apply"
          />
        </View>
        <TextLink
          quiet
          label={t('events.filters.clearAll')}
          onPress={() => setDraft({ radius: 0, ageBand: null, tag: '', language: null })}
        />
      </View>
    </BottomSheet>
  );
}
