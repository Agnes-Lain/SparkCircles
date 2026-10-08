import { Baby, Clock, Inbox, Info, Phone, UserCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';

import type { SparkEvent } from '../../api/events';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { IconSquare } from '../../components/IconSquare';
import { TextLink } from '../../components/TextLink';
import { resolveLocale } from '../../i18n';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { shadows } from '../../theme/colors';
import { formatDeadline } from './format';
import { displayPhone, telUrl } from './phone';

// US-17 building blocks (design events-dropoff-approval, sections 3.2 to 3.5 and 6).

/** True for a drop-off event ("Présence d'un adulte : facultatif", AC-17.1). */
export const isDropoff = (event: Pick<SparkEvent, 'adult_required'>) =>
  event.adult_required === false;

/**
 * `dnote`: the drop-off notice (AC-17.5), text + `baby` icon on the yellow Reminder
 * surface, never colour alone. The icon is hidden from screen readers.
 */
export function DropoffNotice({
  title,
  body,
  testID,
}: {
  title: string;
  body?: string;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      className="flex-row items-start gap-md rounded-lg bg-sunny-light px-lg py-md"
    >
      <Icon icon={Baby} size={20} color="sunny-dark" />
      <View className="flex-1 gap-xs">
        <Text className="text-body font-medium text-ink">{title}</Text>
        {body ? <Text className="text-caption text-ink-2">{body}</Text> : null}
      </View>
    </View>
  );
}

/** `dline`: the one-line notice on cards and in the join sheet (AC-17.5). */
export function DropoffLine({ label, testID }: { label: string; testID?: string }) {
  return (
    <View className="flex-row" testID={testID}>
      <View className="flex-row items-center gap-xs rounded-sm bg-sunny-light px-sm py-xs">
        <Icon icon={Baby} size={14} color="sunny-dark" />
        <Text className="shrink text-caption font-medium text-ink">{label}</Text>
      </View>
    </View>
  );
}

/** "Sur demande" (approval on, any event): neutral badge with `user-check`, text + icon. */
export function OnRequestBadge({ testID }: { testID?: string }) {
  const { t } = useTranslation();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={t('events.dropoff.onRequest')}
      className="flex-row items-center gap-xs rounded-pill border-[0.5px] border-border-soft bg-shell px-2.5 py-1"
    >
      <Icon icon={UserCheck} size={12} color="ink-2" />
      <Text className="text-[11px] font-medium text-ink-2">{t('events.dropoff.onRequest')}</Text>
    </View>
  );
}

/** A phone number as a tap-to-call link only (no copy button, PM decision 5), 44 px. */
export function PhoneLink({
  phone,
  accessibilityLabel,
  testID,
}: {
  phone: string;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={() => void Linking.openURL(telUrl(phone))}
      className="justify-center self-start"
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      <Text className="text-h3 text-green-dark">{displayPhone(phone)}</Text>
    </Pressable>
  );
}

/**
 * The host's phone for an accepted parent (AC-17.9, AC-17.12), right under the address,
 * until 24 hours after the end; then a caption says it is no longer shown.
 */
export function HostPhoneCard({ event, now = new Date() }: { event: SparkEvent; now?: Date }) {
  const { t } = useTranslation();
  const until = event.phone_visible_until ? new Date(event.phone_visible_until) : null;
  const over = until !== null && until.getTime() <= now.getTime();
  if (over || !event.host_phone) {
    return over ? (
      <Text className="text-caption text-ink-3" testID="host-phone-gone">
        {t('events.dropoff.phoneGone')}
      </Text>
    ) : null;
  }
  return (
    <View
      testID="host-phone-card"
      className="flex-row items-start gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
      style={{ boxShadow: shadows.card }}
    >
      <IconSquare icon={Phone} tone="verification" />
      <View className="flex-1">
        <Text className="text-caption text-ink-2">{t('events.dropoff.hostPhoneCaption')}</Text>
        <PhoneLink
          phone={event.host_phone}
          accessibilityLabel={t('events.dropoff.callHost', {
            number: displayPhone(event.host_phone),
          })}
          testID="host-phone-link"
        />
        <Text className="text-caption text-ink-3">{t('events.dropoff.hostPhoneNote')}</Text>
      </View>
    </View>
  );
}

/** The parent's request states on the detail (design 3.4), one at a time. */
export function RequestNote({
  event,
  onSeeEvents,
}: {
  event: SparkEvent;
  /** #40: a quiet « Voir les sorties » under a closed or declined request. */
  onSeeEvents?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const request = event.viewer.request;
  if (!request) return null;
  if (request.status === 'pending') {
    return (
      <StateNote
        tone="pending"
        title={t('events.dropoff.pendingTitle')}
        body={
          request.expires_at
            ? t('events.dropoff.pendingBody', {
                date: formatDeadline(request.expires_at, event.time_zone, locale),
              })
            : undefined
        }
        testID="request-pending"
      />
    );
  }
  if (request.status === 'declined')
    return (
      <StateNote
        tone="neutral"
        title={t('events.dropoff.declinedTitle')}
        body={t('events.dropoff.declinedBody')}
        testID="request-declined"
        onSeeEvents={onSeeEvents}
      />
    );
  if (request.status === 'expired')
    return (
      <StateNote
        tone="pending"
        title={t('events.dropoff.expiredTitle')}
        body={t('events.dropoff.expiredBody')}
        testID="request-expired"
      />
    );
  if (request.closed_reason === 'full')
    return (
      <StateNote
        tone="neutral"
        title={t('events.dropoff.closedFullTitle')}
        body={t('events.dropoff.closedFullBody')}
        testID="request-closed-full"
        onSeeEvents={onSeeEvents}
      />
    );
  return (
    <StateNote
      tone="neutral"
      title={t('events.dropoff.closedOtherTitle')}
      body={t('events.dropoff.closedOtherBody')}
      testID="request-closed"
      onSeeEvents={onSeeEvents}
    />
  );
}

/** Pending/expired: yellow with `clock`; declined/closed: Shell with `info` (never colour alone). */
function StateNote({
  tone,
  title,
  body,
  testID,
  onSeeEvents,
}: {
  tone: 'pending' | 'neutral';
  title: string;
  body?: string;
  testID?: string;
  onSeeEvents?: () => void;
}) {
  const note = (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      className={`flex-row items-start gap-md rounded-lg px-lg py-md ${
        tone === 'pending' ? 'bg-sunny-light' : 'border-[0.5px] border-border-soft bg-shell'
      }`}
    >
      <Icon
        icon={tone === 'pending' ? Clock : Info}
        size={20}
        color={tone === 'pending' ? 'sunny-dark' : 'ink-2'}
      />
      <View className="flex-1 gap-xs">
        <Text className="text-body font-medium text-ink">{title}</Text>
        {body ? <Text className="text-caption text-ink-2">{body}</Text> : null}
      </View>
    </View>
  );
  if (!onSeeEvents) return note;
  return (
    <View className="gap-xs">
      {note}
      <SeeEventsLink onPress={onSeeEvents} />
    </View>
  );
}

/** #40: the quiet next step under a negative notice for a viewer (never the host). */
export function SeeEventsLink({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="items-start">
      <TextLink quiet label={t('events.detail.seeEvents')} onPress={onPress} testID="see-events" />
    </View>
  );
}

/** "Demande envoyée · 3 places" (the sticky bar's status). */
export function PendingBadge({ places }: { places: number }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-center gap-xs" testID="pending-badge">
      <Icon icon={Clock} size={14} color="sunny-dark" />
      <Badge kind="badge-yellow" label={t('events.dropoff.pendingBadge', { count: places })} />
    </View>
  );
}

/**
 * E4 host block (design 3.5): the number of requests waiting, for the host only
 * (AC-17.15), and the way to the request list.
 */
export function HostRequestsCard({ count, onOpen }: { count: number; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <View
      testID="host-requests-card"
      className="gap-sm rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
      style={{ boxShadow: shadows.card }}
    >
      <View className="flex-row items-center gap-md">
        <IconSquare icon={Inbox} />
        <Text
          className="flex-1 text-h3 text-ink"
          accessibilityLiveRegion="polite"
          testID="host-requests-count"
        >
          {count > 0 ? t('events.dropoff.waiting', { count }) : t('events.dropoff.noRequests')}
        </Text>
        {count > 0 ? <Badge kind="badge-yellow" label={t('events.dropoff.toAnswer')} /> : null}
      </View>
      {count > 0 ? (
        <Button
          variant="secondary"
          label={t('events.dropoff.seeRequests')}
          onPress={onOpen}
          testID="see-requests"
        />
      ) : (
        <View className="items-start">
          <TextLink
            label={t('events.dropoff.seeRequests')}
            onPress={onOpen}
            testID="see-requests"
          />
        </View>
      )}
    </View>
  );
}
