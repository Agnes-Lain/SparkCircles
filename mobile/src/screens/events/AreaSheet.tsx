import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import type { EventOptions } from '../../api/events';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { RadioRow } from '../../components/RadioRow';
import { Skeleton } from '../../components/Skeleton';
import { TextField } from '../../components/TextField';

/** Lower-case without accents, to match "paris 11" with "Paris 11e". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Mounted afresh each time it opens (the parent changes its `key`), so it starts from the
 * current area.
 *
 * E1c Choose area (AC-3.3): asked once, changeable any time from the area selector. No GPS:
 * a radio list of the areas from `GET /event_options`, filtered by what is typed.
 */
export function AreaSheet({
  visible,
  areas,
  current,
  onChoose,
  onClose,
}: {
  visible: boolean;
  areas: EventOptions['areas'] | undefined;
  current: string | null;
  onChoose: (area: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(current);

  const shown = (areas ?? []).filter((area) => fold(area.label).includes(fold(query)));

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="area-sheet">
      <View className="gap-xs">
        <Text accessibilityRole="header" className="text-h2 text-ink">
          {t('events.area.sheetTitle')}
        </Text>
        <Text className="text-body text-ink-2">{t('events.area.sheetBody')}</Text>
      </View>
      <TextField
        label={t('events.area.searchLabel')}
        value={query}
        onChangeText={setQuery}
        leading={<Icon icon={Search} size={18} color="ink-2" />}
        testID="area-search"
      />
      <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
        <View accessibilityRole="radiogroup">
          {areas
            ? shown.map((area) => (
                <RadioRow
                  key={area.key}
                  label={area.label}
                  selected={selected === area.key}
                  onPress={() => setSelected(area.key)}
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
      <View className="gap-xs">
        <Button
          size="large"
          label={t('events.area.use')}
          disabled={!selected}
          onPress={() => selected && onChoose(selected)}
          testID="area-use"
        />
        {!selected ? (
          <Text className="text-center text-caption text-ink-3">{t('events.area.required')}</Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
