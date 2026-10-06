import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Calendar, Clock } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '../theme/a11y';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Icon } from './Icon';

export type DateTimeFieldProps = {
  mode: 'date' | 'time';
  label: string;
  /** What the row shows ("Sam. 10 oct.", "15:00"); empty shows the placeholder. */
  display: string;
  placeholder: string;
  /** The moment the picker opens on. */
  value: Date;
  onChange: (moment: Date) => void;
  minimumDate?: Date;
  /** "fr-FR" or "en-GB": the iOS picker's language (Android follows the system). */
  locale: string;
  error?: string;
  hideErrorText?: boolean;
  testID?: string;
};

/**
 * A text-field-like row that opens the platform date or time picker (design events gap G6,
 * QA BUG-5): the Android dialog, or the iOS picker in a bottom sheet with "Done". Nothing is
 * typed, so no keyboard autofill can offer the user's own birth date.
 */
export const DateTimeField = forwardRef<View, DateTimeFieldProps>(function DateTimeField(
  {
    mode,
    label,
    display,
    placeholder,
    value,
    onChange,
    minimumDate,
    locale,
    error,
    hideErrorText,
    testID,
  },
  ref,
) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const is24Hour = !locale.startsWith('en-US');

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode,
        value,
        minimumDate,
        is24Hour,
        onValueChange: (_event, picked) => onChange(picked),
      });
      return;
    }
    setDraft(value);
    setOpen(true);
  };

  const border = error ? 'border-error-dark' : 'border-ink-3';
  const shown = display || placeholder;

  return (
    <View className="gap-xs">
      <Text className="text-body text-ink-2">{label}</Text>
      <Pressable
        ref={ref}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${shown}${error ? `. ${error}` : ''}`}
        accessibilityHint={t('events.form.pickerHint')}
        onPress={openPicker}
        className={`flex-row items-center gap-sm rounded-md border-[1.5px] bg-surface px-3.5 ${border}`}
        style={{ minHeight: MIN_TOUCH_TARGET }}
      >
        <Icon icon={mode === 'date' ? Calendar : Clock} size={18} color="ink-2" />
        <Text className={`flex-1 text-body ${display ? 'text-ink' : 'text-ink-3'}`}>{shown}</Text>
      </Pressable>
      {error && !hideErrorText ? (
        <Text className="text-caption text-error-dark" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {Platform.OS === 'android' ? null : (
        <BottomSheet visible={open} onClose={() => setOpen(false)} testID={`${testID}-sheet`}>
          <Text accessibilityRole="header" className="text-h2 text-ink">
            {label}
          </Text>
          <View className="items-center">
            <DateTimePicker
              testID={`${testID}-picker`}
              mode={mode}
              display={mode === 'date' ? 'inline' : 'spinner'}
              value={draft}
              minimumDate={minimumDate}
              locale={locale}
              is24Hour={is24Hour}
              accessibilityLabel={label}
              onValueChange={(_event, picked) => setDraft(picked)}
            />
          </View>
          <Button
            size="large"
            label={t('events.form.pickerDone')}
            onPress={() => {
              setOpen(false);
              onChange(draft);
            }}
            testID={`${testID}-done`}
          />
        </BottomSheet>
      )}
    </View>
  );
});
