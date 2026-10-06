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
import { Notification } from '../../components/Notification';
import { Stepper } from '../../components/Stepper';
import { resolveLocale } from '../../i18n';
import { formatShortDay, formatTime } from './format';
import { personName } from './presenters';
import { refreshEvents, storeEvent } from './queries';

type Problem =
  { kind: 'race'; left: number } | { kind: 'offline' } | { kind: 'rateLimited' } | null;
type Step = 'form' | 'full' | 'started' | 'restricted';

/** Keeps at least one adult and the total within `available` (adults kept first). */
export function clampParty(adults: number, children: number, available: number) {
  const a = Math.max(1, Math.min(adults, available));
  const c = Math.max(0, Math.min(children, available - a));
  return { adults: a, children: c };
}

/**
 * E3 Join sheet (AC-5.1 to 5.3, 5.8): adults (at least 1) and children within the places
 * left; one tap confirms the default 1 adult. The same sheet changes the places of someone
 * who joined. Overbooking races are answered by the server: the steppers are clamped to
 * what is left, or the sheet says the event just became full.
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
  const own = change && mine ? mine.places : 0;
  const [available, setAvailable] = useState(event.places.left + own);
  const [adults, setAdults] = useState(change && mine ? mine.adults : 1);
  const [children, setChildren] = useState(change && mine ? mine.children : 0);
  const [problem, setProblem] = useState<Problem>(null);
  const [step, setStep] = useState<Step>('form');

  // Mounted afresh on each opening (the detail changes its `key`), so the state above starts
  // from the event as it is now.

  const places = adults + children;
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

  const mutation = useMutation<{ event: SparkEvent }, ApiError, void>({
    mutationFn: () =>
      change
        ? events().changePlaces(event.id, { adults, children })
        : events().join(event.id, { adults, children }),
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
        const clamped = clampParty(adults, children, left);
        setAvailable(left);
        setAdults(clamped.adults);
        setChildren(clamped.children);
        setProblem({ kind: 'race', left });
      } else if (error.code === 'verification_required') {
        setStep('restricted');
      } else if (
        error.code === 'event_started' ||
        error.code === 'event_not_joinable' ||
        error.code === 'not_found'
      ) {
        refreshEvents(queryClient, event.id);
        setStep('started');
      } else if (error.code === 'rate_limited') {
        setProblem({ kind: 'rateLimited' });
      } else {
        setProblem({ kind: 'offline' });
      }
    },
  });

  const host = event.host;

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="join-sheet">
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
      ) : step === 'started' ? (
        <View className="gap-lg" testID="join-started">
          <Text accessibilityRole="header" className="text-h2 text-ink">
            {t('events.detail.started')}
          </Text>
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
            <Text className="text-body font-medium text-ink">{event.title}</Text>
            <Text className="text-caption text-ink-2">
              {`${formatShortDay(event.starts_at, event.time_zone, locale)} · ${formatTime(
                event.starts_at,
                event.time_zone,
              )}`}
            </Text>
            {host && !host.former_member ? (
              <View className="flex-row items-center gap-sm">
                <Text className="text-caption text-ink">{personName(host, t)}</Text>
                {host.verified ? (
                  <Badge kind="badge-green" label={t('events.badge.verified')} />
                ) : null}
              </View>
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
            helper={t('events.join.adultsHelp')}
            value={adults}
            min={1}
            max={Math.max(1, available - children)}
            onChange={setAdults}
            decreaseLabel={t('events.join.fewerAdults')}
            increaseLabel={t('events.join.moreAdults')}
            testID="adults"
          />
          <Stepper
            label={t('events.join.children')}
            helper={t('events.join.childrenHelp')}
            value={children}
            min={0}
            max={Math.max(0, available - adults)}
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
          <Button
            size="large"
            label={change ? t('events.join.save') : t('events.join.confirm')}
            loading={mutation.isPending}
            onPress={() => {
              setProblem(null);
              mutation.mutate();
            }}
            testID="join-confirm"
          />
        </View>
      )}
    </BottomSheet>
  );
}
