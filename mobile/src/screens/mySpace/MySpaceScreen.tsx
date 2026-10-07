import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../api';
import { useMe } from '../../auth/useMe';
import { HeaderIconButton } from '../../components/HeaderIconButton';
import { SegmentedControl } from '../../components/SegmentedControl';
import { SuccessCheckmark } from '../../components/SuccessCheckmark';
import { useToast } from '../../components/ToastProvider';
import { colorValue } from '../../theme/colors';
import { UnreachableNotification } from '../auth/UnreachableNotification';
import { ApiHealthCheck } from '../dev/ApiHealthCheck';
import { todayInZone } from './agenda';
import { AccountPanel, accountNeedsAttention } from './AccountPanel';
import { refetchToday, TodayPanel, useTodayQueries } from './TodayPanel';

export type MySpaceView = 'today' | 'account';

// The segment chosen, kept in memory (design my-space 1) so a remount or a screen pushed on
// top keeps « Mon compte ». Each app start, and each return from another tab, opens on
// « Aujourd'hui » (spec my-space); logging out or in forgets it with the query cache.
const VIEW_KEY = ['my-space', 'view'] as const;

/**
 * My space (spec my-space, design my-space 1): H1 and the notifications bell (a placeholder
 * until backlog #17, no unread dot), then « Aujourd'hui | Mon compte » (Lavender). Opens on
 * Today, also when the tab comes back after another tab; `?view=account` (the `/account`
 * link) opens « Mon compte » (AC-7.4). Coming back from a screen pushed from « Mon compte »
 * keeps it. One scroll,
 * pull to refresh, refresh when the tab comes back into view (AC-3.5).
 */
export function MySpaceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe();
  const params = useLocalSearchParams<{ view?: string }>();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const [view, setView] = useState<MySpaceView>(() =>
    params.view === 'account'
      ? 'account'
      : (queryClient.getQueryData<MySpaceView>(VIEW_KEY) ?? 'today'),
  );
  // A later `/account` link while the tab is already open switches to « Mon compte ».
  const [linkView, setLinkView] = useState(params.view);
  if (params.view !== linkView) {
    setLinkView(params.view);
    if (params.view === 'account') setView('account');
  }
  useEffect(() => {
    queryClient.setQueryData(VIEW_KEY, view);
  }, [queryClient, view]);
  // Reset when another tab takes over; a screen pushed on top (edit profile, agenda…)
  // leaves the tab navigator on My space, so « Mon compte » stays.
  useEffect(
    () =>
      navigation.addListener('blur', () => {
        const state = navigation.getState();
        if (state?.type === 'tab' && state.routes[state.index]?.name !== 'my-space')
          setView('today');
      }),
    [navigation],
  );
  useEffect(() => {
    // Cleared so the same link works again later.
    if (params.view === 'account') router.setParams({ view: undefined });
  }, [params.view, router]);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const queries = useTodayQueries();
  const scroll = useRef<ScrollView>(null);
  const panelY = useRef(0);
  const { takeCelebration } = useToast();
  // Email just confirmed: the success checkmark plays when My space comes into view (design P1, S3).
  const [celebrating, setCelebrating] = useState(false);

  const firstFocus = useRef(true);
  const queriesRef = useRef(queries);
  useEffect(() => {
    queriesRef.current = queries;
  });
  useFocusEffect(
    useCallback(() => {
      if (takeCelebration()) setCelebrating(true);
      setNow(new Date());
      if (firstFocus.current) {
        firstFocus.current = false;
        AccessibilityInfo.announceForAccessibility(t('mySpace.loading'));
        return;
      }
      void refetchToday(queriesRef.current);
      void me.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [takeCelebration]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setNow(new Date());
    await Promise.all([refetchToday(queries), me.refetch()]);
    setRefreshing(false);
    AccessibilityInfo.announceForAccessibility(t('mySpace.updated'));
  };

  const user = me.data;
  const attention =
    user && accountNeedsAttention(user) ? t('mySpace.segment.needsAttention') : undefined;

  return (
    <SafeAreaView edges={['top']} className="flex-1" testID="my-space-screen">
      <ScrollView
        ref={scroll}
        contentContainerClassName="gap-lg px-lg pb-3xl pt-xl"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colorValue('lavender-dark')}
            colors={[colorValue('lavender-dark')]}
          />
        }
      >
        <View className="flex-row items-center justify-between gap-md">
          <Text accessibilityRole="header" className="flex-1 text-h1 text-ink">
            {t('tabs.mySpace')}
          </Text>
          {/* Placeholder: notifications aren't built yet (no unread dot, nothing to open). */}
          <HeaderIconButton
            icon={Bell}
            accessibilityLabel={t('mySpace.notifications')}
            onPress={() => undefined}
            testID="notifications-entry"
          />
        </View>

        <SegmentedControl
          module="mySpace"
          testIDPrefix="my-space-segment"
          accessibilityLabel={t('mySpace.segmentsLabel')}
          tabPosition={(position, count) => t('mySpace.segment.position', { position, count })}
          segments={[
            { key: 'today', label: t('mySpace.segment.today') },
            { key: 'account', label: t('mySpace.segment.account'), attention },
          ]}
          value={view}
          onChange={setView}
        />

        {celebrating ? (
          <View className="items-center">
            <SuccessCheckmark />
          </View>
        ) : null}

        <View
          onLayout={(e) => {
            panelY.current = e.nativeEvent.layout.y;
          }}
        >
          {!user ? (
            me.isError ? (
              <UnreachableNotification onRetry={() => void me.refetch()} retrying={me.isFetching} />
            ) : null
          ) : view === 'account' ? (
            <AccountPanel me={user} />
          ) : (
            <TodayPanel
              me={user}
              queries={queries}
              today={todayInZone(now)}
              now={now}
              onScrollTo={(y) =>
                scroll.current?.scrollTo({ y: panelY.current + y, animated: false })
              }
            />
          )}
        </View>

        {__DEV__ && view === 'today' ? <ApiHealthCheck client={api} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
