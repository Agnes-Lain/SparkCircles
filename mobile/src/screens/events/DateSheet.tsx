import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { FilterChip } from '../../components/FilterChip';
import { resolveLocale } from '../../i18n';
import { addDays, formatCalendarDay } from './format';

const DAYS_AHEAD = 42;

/** "Pick a date" (AC-3.2): a simple picker of the next six weeks; one tap picks and closes. */
export function DateSheet({
  visible,
  today,
  selected,
  onPick,
  onClose,
}: {
  visible: boolean;
  today: string;
  selected: string | null;
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  return (
    <BottomSheet visible={visible} onClose={onClose} testID="date-sheet">
      <Text accessibilityRole="header" className="text-h2 text-ink">
        {t('events.dates.pick')}
      </Text>
      <ScrollView style={{ maxHeight: 360 }}>
        <View className="flex-row flex-wrap gap-sm py-sm">
          {days.map((day) => (
            <FilterChip
              key={day}
              label={formatCalendarDay(day, locale)}
              selected={selected === day}
              onPress={() => onPick(day)}
              testID={`date-${day}`}
            />
          ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
