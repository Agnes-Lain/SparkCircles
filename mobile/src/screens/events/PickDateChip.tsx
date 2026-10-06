import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { IOS_PICKER_THEME } from '../../components/DateTimeField';
import { FilterChip } from '../../components/FilterChip';
import { resolveLocale } from '../../i18n';
import { formatCalendarDay } from './format';

/** How far ahead search can look: the API sets no limit on `to` (docs/api/events.md), so 6 months. */
const MONTHS_AHEAD = 6;

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-12" → a local Date at midnight (what the native picker works with). */
function toDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** The picker's local Date → "2026-10-12". */
function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The search window of the picker: today to today + 6 months. */
export function pickRange(today: string): { min: Date; max: Date } {
  const min = toDate(today);
  const max = new Date(min.getFullYear(), min.getMonth() + MONTHS_AHEAD, min.getDate());
  return { min, max };
}

/**
 * "Pick a date" (AC-3.2): a date chip that opens the native date picker (Android dialog, or
 * the iOS calendar in a sheet with "OK"), from today to 6 months ahead. The chosen day shows
 * in the chip ("Sam. 12 oct."); "Clear date" goes back to no date filter.
 */
export function PickDateChip({
  today,
  selected,
  onPick,
  onClear,
}: {
  today: string;
  selected: string | null;
  onPick: (date: string) => void;
  onClear: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const pickerLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const [open, setOpen] = useState(false);
  const { min, max } = pickRange(today);
  const value = selected ? toDate(selected) : min;
  const [draft, setDraft] = useState(value);
  const shown = selected ? formatCalendarDay(selected, locale) : null;

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        value,
        minimumDate: min,
        maximumDate: max,
        neutralButton: selected ? { label: t('events.dates.clear') } : undefined,
        onValueChange: (_event, picked) => onPick(toIsoDate(picked)),
        onNeutralButtonPress: onClear,
      });
      return;
    }
    setDraft(value);
    setOpen(true);
  };

  return (
    <>
      <FilterChip
        label={shown ?? t('events.dates.pick')}
        icon={Calendar}
        selected={Boolean(selected)}
        accessibilityLabel={
          shown ? t('events.dates.picked', { date: shown }) : t('events.dates.pick')
        }
        accessibilityHint={t('events.form.pickerHint')}
        onPress={openPicker}
        testID="date-pick"
      />
      {Platform.OS === 'android' ? null : (
        <BottomSheet visible={open} onClose={() => setOpen(false)} testID="date-pick-sheet">
          <Text accessibilityRole="header" className="text-h2 text-ink">
            {t('events.dates.pick')}
          </Text>
          <View className="items-center">
            <DateTimePicker
              testID="date-pick-picker"
              mode="date"
              display="inline"
              value={draft}
              minimumDate={min}
              maximumDate={max}
              locale={pickerLocale}
              {...IOS_PICKER_THEME}
              accessibilityLabel={t('events.dates.pick')}
              onValueChange={(_event, picked) => setDraft(picked)}
            />
          </View>
          <Button
            size="large"
            label={t('events.form.pickerDone')}
            onPress={() => {
              setOpen(false);
              onPick(toIsoDate(draft));
            }}
            testID="date-pick-done"
          />
          {selected ? (
            <Button
              variant="ghost"
              label={t('events.dates.clear')}
              onPress={() => {
                setOpen(false);
                onClear();
              }}
              testID="date-pick-clear"
            />
          ) : null}
        </BottomSheet>
      )}
    </>
  );
}
