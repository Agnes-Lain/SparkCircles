import { CalendarPlus, Info } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { SparkEvent } from '../../api/events';
import { Icon } from '../../components/Icon';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { resolveLocale } from '../../i18n';
import { formatLongDay, formatTime } from './format';
import { titleText } from './presenters';
import { shareEventCalendar } from './calendar';

/**
 * #41 step 1 « Ajouter à mon calendrier »: a quiet row under the date (design 3). The .ics is
 * made on the phone and handed to the share sheet; a toast when it is done, an inline note
 * with the date when the file cannot be made or shared (no error red).
 */
export function AddToCalendar({ event }: { event: SparkEvent }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const { showToast } = useToast();
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const title = titleText(event, t);

  const add = async () => {
    if (busy.current) return;
    busy.current = true;
    setFailed(false);
    try {
      const result = await shareEventCalendar(event, {
        description: t('events.calendar.description'),
        dialogTitle: t('events.calendar.add'),
      });
      if (result === 'shared') showToast(t('events.calendar.ready'));
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  };

  const date =
    event.starts_at && event.ends_at
      ? `${formatLongDay(event.starts_at, event.time_zone, locale)} · ${formatTime(
          event.starts_at,
          event.time_zone,
        )}–${formatTime(event.ends_at, event.time_zone)}`
      : '';

  return (
    <View className="items-start" testID="add-to-calendar">
      <TextLink
        label={t('events.calendar.add')}
        accessibilityLabel={t('events.calendar.addA11y', { title })}
        accessibilityRole="button"
        icon={CalendarPlus}
        iconSize={18}
        onPress={() => void add()}
        testID="add-to-calendar-link"
      />
      {failed ? (
        <View className="flex-row items-start gap-xs" testID="calendar-fallback">
          <Icon icon={Info} size={14} color="ink-2" />
          <Text className="flex-1 text-caption text-ink-2">
            {t('events.calendar.fallback', { date })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
