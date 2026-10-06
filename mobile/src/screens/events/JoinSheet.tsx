import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';

import { events } from '../../api';
import type { ApiError } from '../../api/errors';
import type { SparkEvent } from '../../api/events';
import { Badge } from '../../components/Badge';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { Notification } from '../../components/Notification';
import { Stepper } from '../../components/Stepper';
import { TextField } from '../../components/TextField';
import { resolveLocale } from '../../i18n';
import { DropoffLine, isDropoff } from './dropoff';
import { formatShortDay, formatTime } from './format';
import { displayPhone, normalizePhone } from './phone';
import { personName, titleText } from './presenters';
import { forgetParticipation, freshEvent, refreshEvents, storeEvent } from './queries';
import { type ClosedReason, closedReason, isRefusal, refusalText } from './refusals';

type Problem =
  { kind: 'race'; left: number } | { kind: 'offline' } | { kind: 'rateLimited' } | null;
type Step = 'form' | 'full' | 'closed' | 'restricted';

/**
 * Keeps at least one adult (or, on a drop-off event, at least one child, AC-17.2) and the
 * total within `available` (adults kept first, children first for drop-off).
 */
export function clampParty(adults: number, children: number, available: number, dropoff = false) {
  if (dropoff) {
    const c = Math.max(1, Math.min(children, available));
    const a = Math.max(0, Math.min(adults, available - c));
    return { adults: a, children: c };
  }
  const a = Math.max(1, Math.min(adults, available));
  const c = Math.max(0, Math.min(children, available - a));
  return { adults: a, children: c };
}

/** The party a sheet opens with: the current places, a request sent again, or the default. */
function startingParty(event: SparkEvent, change: boolean, dropoff: boolean) {
  const mine = event.my_participation;
  if (change && mine) return { adults: mine.adults, children: mine.children };
  const previous = event.viewer.request;
  if (previous) return { adults: previous.adults, children: previous.children };
  // Design 3.3: drop-off starts at 1 adult + 1 child (one tap to the minimum case).
  return { adults: 1, children: dropoff ? 1 : 0 };
}

/**
 * E3 Join sheet (AC-5.1 to 5.3, 5.8): adults (at least 1) and children within the places
 * left; one tap confirms the default 1 adult. The same sheet changes the places of someone
 * who joined. Overbooking races are answered by the server: the steppers are clamped to
 * what is left, or the sheet says the event just became full.
 *
 * US-17: on a drop-off event, 0 adults is allowed with at least one child, the emergency
 * phone is required with 0 adults, and the "I stay responsible" box must be ticked (AC-17.2,
 * AC-17.6, AC-17.7). With approval, the CTA sends a request (AC-17.14); more places for an
 * accepted parent are a request, fewer are saved at once (AC-17.21).
 */
export function JoinSheet({
  event,
  visible,
  change,
  onClose,
  onJoined,
  onVerify,
}: {
  event: SparkEvent;
  visible: boolean;
  /** "Change my places": pre-filled with the current party. */
  change: boolean;
  onClose: () => void;
  onJoined: (event: SparkEvent, places: number) => void;
  onVerify: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const queryClient = useQueryClient();
  const mine = event.my_participation;
  const dropoff = isDropoff(event);
  const approval = event.approval_required;
  const own = change && mine ? mine.places : 0;
  const [available, setAvailable] = useState(event.places.left + own);
  const [start] = useState(() => {
    const party = startingParty(event, change, dropoff);
    return clampParty(party.adults, party.children, Math.max(1, event.places.left + own), dropoff);
  });
  const [adults, setAdults] = useState(start.adults);
  const [children, setChildren] = useState(start.children);
  const [phone, setPhone] = useState(
    change && mine?.emergency_phone ? displayPhone(mine.emergency_phone) : '',
  );
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [step, setStep] = useState<Step>('form');
  const [closed, setClosed] = useState<ClosedReason>('started');

  // Mounted afresh on each opening (the detail changes its `key`), so the state above starts
  // from the event as it is now.

  const places = adults + children;
  const phoneRequired = dropoff && adults === 0;
  // AC-17.6: the box is ticked before joining (not when changing places already booked).
  const needsTick = dropoff && !change;
  const blocked = needsTick && !acknowledged;
  // AC-17.14, AC-17.21: a request, unless it only lowers the places already booked.
  const asRequest = approval && (!change || places > own);
  const ctaLabel = asRequest
    ? t('events.dropoff.sendRequest')
    : change
      ? approval
        ? t('events.dropoff.savePlaces')
        : t('events.join.save')
      : t('events.join.confirm');
  const summaryText = t('events.join.summary', { count: places, left: available });
  const announce = `${t('events.detail.adults', { count: adults })}, ${t('events.detail.children', {
    count: children,
  })}, ${summaryText}`;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (visible && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(announce);
  }, [announce, visible]);
  // Design 3.3: the field becomes required as soon as the adults reach 0 (live announcement).
  const wasRequired = useRef(phoneRequired);
  useEffect(() => {
    if (phoneRequired && !wasRequired.current && visible)
      AccessibilityInfo.announceForAccessibility(t('events.dropoff.emergencyNowRequired'));
    wasRequired.current = phoneRequired;
  }, [phoneRequired, visible, t]);

  /** AC-17.7, AC-17.11: checked before sending, with the design's plain messages. */
  const checkPhone = (): string | null | false => {
    if (!dropoff) return null;
    if (!phone.trim()) {
      if (phoneRequired) {
        setPhoneError(t('events.dropoff.emergencyMissing'));
        return false;
      }
      return null;
    }
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setPhoneError(t('events.dropoff.phoneInvalid'));
      return false;
    }
    return normalized;
  };

  const mutation = useMutation<{ event: SparkEvent }, ApiError, string | null>({
    mutationFn: (emergencyPhone) => {
      const body = {
        adults,
        children,
        ...(emergencyPhone ? { emergency_phone: emergencyPhone } : {}),
      };
      return change
        ? events().changePlaces(event.id, body)
        : events().join(event.id, dropoff ? { ...body, responsibility_acknowledged: true } : body);
    },
    onSuccess: (data) => {
      storeEvent(queryClient, data.event);
      onJoined(data.event, places);
    },
    onError: (error) => {
      if (error.code === 'not_enough_places') {
        const left = (error.placesLeft ?? 0) + own;
        refreshEvents(queryClient, event.id);
        if (left <= 0) {
          setStep('full');
          return;
        }
        const clamped = clampParty(adults, children, left, dropoff);
        setAvailable(left);
        setAdults(clamped.adults);
        setChildren(clamped.children);
        setProblem({ kind: 'race', left });
      } else if (error.code === 'verification_required') {
        setStep('restricted');
      } else if (error.code === 'validation_failed' && error.details?.emergency_phone) {
        setPhoneError(
          error.details.emergency_phone[0] === 'blank'
            ? t('events.dropoff.emergencyMissing')
            : t('events.dropoff.phoneInvalid'),
        );
      } else if (
        error.code === 'already_joined' ||
        error.code === 'own_event' ||
        error.code === 'not_joined' ||
        error.code === 'already_requested' ||
        error.code === 'request_declined'
      ) {
        // BUG-3: already in (or the host, or no longer in): the page shows the real state.
        if (error.code === 'not_joined') forgetParticipation(queryClient, event.id);
        else refreshEvents(queryClient, event.id);
        onClose();
      } else if (isRefusal(error)) {
        // BUG-3: cancelled, on hold, started or gone: say which, from the event as it is now.
        const show = (reason: ClosedReason) => {
          setClosed(reason);
          setStep('closed');
        };
        if (error.code === 'event_started') {
          refreshEvents(queryClient, event.id);
          show('started');
        } else {
          void freshEvent(queryClient, event.id).then((fresh) => show(closedReason(fresh)));
        }
      } else if (error.code === 'rate_limited') {
        setProblem({ kind: 'rateLimited' });
      } else {
        setProblem({ kind: 'offline' });
      }
    },
  });

  const host = event.host;
  // Sticky footer: the CTA stays above the keyboard while the emergency phone is typed.
  const cta = (
    <View className="gap-xs">
      <Button
        size="large"
        label={ctaLabel}
        disabled={blocked}
        loading={mutation.isPending}
        accessibilityHint={blocked ? t('events.dropoff.tickToContinue') : undefined}
        onPress={() => {
          setProblem(null);
          const checked = checkPhone();
          if (checked === false) return;
          mutation.mutate(checked);
        }}
        testID="join-confirm"
      />
      {blocked ? (
        <Text className="text-center text-caption text-ink-3" testID="join-tick-caption">
          {t('events.dropoff.tickToContinue')}
        </Text>
      ) : null}
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      footer={step === 'form' ? cta : undefined}
      testID="join-sheet"
    >
      {step === 'full' ? (
        <View className="gap-lg" testID="join-full">
          <View className="gap-xs">
            <Text accessibilityRole="header" className="text-h2 text-ink">
              {t('events.join.fullTitle')}
            </Text>
            <Text className="text-body text-ink-2">{t('events.join.fullBody')}</Text>
          </View>
          <Button size="large" label={t('events.detail.seeOthers')} onPress={onClose} />
        </View>
      ) : step === 'closed' ? (
        <View className="gap-lg" testID={`join-${closed}`}>
          <View className="gap-xs">
            <Text accessibilityRole="header" className="text-h2 text-ink">
              {refusalText(closed, t).title}
            </Text>
            {refusalText(closed, t).caption ? (
              <Text className="text-body text-ink-2">{refusalText(closed, t).caption}</Text>
            ) : null}
          </View>
          <Button size="large" label={t('common.ok')} onPress={onClose} />
        </View>
      ) : step === 'restricted' ? (
        <View className="gap-lg" testID="join-restricted">
          <View className="gap-xs">
            <Text accessibilityRole="header" className="text-h2 text-ink">
              {t('events.detail.restrictedTitle')}
            </Text>
            <Text className="text-body text-ink-2">{t('events.detail.restrictedBody')}</Text>
          </View>
          <Button size="large" label={t('events.detail.verifyCta')} onPress={onVerify} />
          <Button variant="ghost" label={t('events.detail.notNow')} onPress={onClose} />
        </View>
      ) : (
        <View className="gap-lg">
          <View className="gap-xs">
            <Text accessibilityRole="header" className="text-h2 text-ink">
              {t('events.join.title')}
            </Text>
            <Text className="text-body text-ink-2">{t('events.join.body')}</Text>
          </View>
          <View accessible className="gap-xs rounded-lg bg-shell p-md">
            <Text className="text-body font-medium text-ink">{titleText(event, t)}</Text>
            {event.starts_at ? (
              <Text className="text-caption text-ink-2">
                {`${formatShortDay(event.starts_at, event.time_zone, locale)} · ${formatTime(
                  event.starts_at,
                  event.time_zone,
                )}`}
              </Text>
            ) : null}
            {host && !host.former_member ? (
              <View className="flex-row items-center gap-sm">
                <Text className="text-caption text-ink">{personName(host, t)}</Text>
                {host.verified ? (
                  <Badge kind="badge-green" label={t('events.badge.verified')} />
                ) : null}
              </View>
            ) : null}
            {dropoff ? (
              <DropoffLine label={t('events.dropoff.sheetLine')} testID="join-dropoff-line" />
            ) : null}
          </View>
          {problem?.kind === 'race' ? (
            <Notification
              level="error"
              title={t('events.join.raceTitle')}
              caption={t('events.join.raceBody', { count: problem.left })}
              testID="join-race"
            />
          ) : problem?.kind === 'offline' ? (
            <Notification
              level="error"
              title={t('errors.unreachable.title')}
              caption={t('events.join.offlineBody')}
              testID="join-offline"
            />
          ) : problem?.kind === 'rateLimited' ? (
            <Notification
              level="error"
              title={t('rateLimited.title')}
              caption={t('rateLimited.wait')}
              testID="join-rate-limited"
            />
          ) : null}
          <Stepper
            label={t('events.join.adults')}
            helper={dropoff ? t('events.dropoff.adultsHelp') : t('events.join.adultsHelp')}
            value={adults}
            min={dropoff ? 0 : 1}
            max={Math.max(dropoff ? 0 : 1, available - children)}
            onChange={setAdults}
            decreaseLabel={t('events.join.fewerAdults')}
            increaseLabel={t('events.join.moreAdults')}
            testID="adults"
          />
          <Stepper
            label={t('events.join.children')}
            helper={dropoff ? t('events.dropoff.childrenHelp') : t('events.join.childrenHelp')}
            value={children}
            min={dropoff ? 1 : 0}
            max={Math.max(dropoff ? 1 : 0, available - adults)}
            onChange={setChildren}
            decreaseLabel={t('events.join.fewerChildren')}
            increaseLabel={t('events.join.moreChildren')}
            testID="children"
          />
          <View className="gap-xs">
            <Text
              className="text-body font-medium text-ink"
              accessibilityLiveRegion="polite"
              testID="join-summary"
            >
              {summaryText}
            </Text>
            {places >= available ? (
              <Text className="text-caption text-ink-3">{t('events.join.atMax')}</Text>
            ) : null}
          </View>
          {dropoff ? (
            <TextField
              kind="emergencyPhone"
              label={
                phoneRequired
                  ? t('events.dropoff.emergencyLabel')
                  : t('events.dropoff.emergencyOptional')
              }
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                if (phoneError) setPhoneError(null);
              }}
              helper={
                phoneRequired
                  ? t('events.dropoff.emergencyHelpRequired')
                  : t('events.dropoff.emergencyHelpOptional')
              }
              error={phoneError}
              testID="emergency-phone"
            />
          ) : null}
          {needsTick ? (
            <Checkbox
              accessibilityLabel={t('events.dropoff.acknowledge')}
              label={t('events.dropoff.acknowledge')}
              checked={acknowledged}
              onChange={setAcknowledged}
              testID="acknowledge"
            />
          ) : null}
          {approval ? (
            <View className="rounded-md bg-sunny-light px-md py-sm" testID="join-request-line">
              <Text className="text-caption text-ink">
                {change ? t('events.dropoff.changeLine') : t('events.dropoff.requestLine')}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}
