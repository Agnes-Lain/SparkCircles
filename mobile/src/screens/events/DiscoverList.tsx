import { useFocusEffect, useRouter } from 'expo-router';
import {
  Calendar,
  ChevronDown,
  Map,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import type { AgeBand, EventLanguage, EventSearch, SparkEvent } from '../../api/events';
import { rememberFilters, type SavedFilters, takeRestoredFilters } from '../../auth/returnTo';
import { Button } from '../../components/Button';
import type { CategoryKey } from '../../components/CategoryPill';
import { CategoryIcon } from '../../components/CategoryPill';
import { EmptyState } from '../../components/EmptyState';
import { EventCard } from '../../components/EventCard';
import { FilterChip } from '../../components/FilterChip';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { Notification } from '../../components/Notification';
import { TextLink } from '../../components/TextLink';
import { useToast } from '../../components/ToastProvider';
import { resolveLocale } from '../../i18n';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { colorValue, shadows } from '../../theme/colors';
import { fontSize } from '../../theme/tokens';
import { BadgeSheet } from '../account/BadgeSheet';
import { AreaSheet, areaSummary } from './AreaSheet';
import { readArea, saveArea } from './areaStore';
import { CATEGORIES, CATEGORY_ICON } from './categories';
import { DateSheet } from './DateSheet';
import { EventListSkeleton } from './EventCardSkeleton';
import { FiltersSheet, normaliseTag, RADIUS_CHOICES, type SheetFilters } from './FiltersSheet';
import { clockTime, formatLongDay, weekendRange, zonedDate, zonedToday } from './format';
import { useEventOptions, useEventSearch } from './queries';
import { useGuestAccount } from '../guest/useGuestAccount';

/** v1 events are all in Paris (contract: `time_zone` is "Europe/Paris"). */
const TIME_ZONE = 'Europe/Paris';
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_HEIGHT = 48;
/** BUG-6: pages fetched on their own while none has a visible event (hosts are re-checked
 *  per page, so a page can be empty while `next_page` is set). */
export const MAX_EMPTY_PAGES = 5;

type DateFilter = SavedFilters['date'];

/** The whole city (guest searches are always scoped to an area, AC-15.9, AC-15.12). */
const ALL_PARIS = 'paris';

type Row =
  { kind: 'day'; key: string; label: string } | { kind: 'event'; key: string; event: SparkEvent };

/** Groups events by local day, soonest first (the API already sorts them). */
export function groupByDay(
  events: SparkEvent[],
  label: (iso: string, tz: string) => string,
): Row[] {
  const rows: Row[] = [];
  let lastDay = '';
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) continue; // a page boundary can repeat an event
    seen.add(event.id);
    if (!event.starts_at) continue; // search lists published events only, always dated
    const day = zonedDate(event.starts_at, event.time_zone);
    if (day !== lastDay) {
      rows.push({ kind: 'day', key: `day-${day}`, label: label(event.starts_at, event.time_zone) });
      lastDay = day;
    }
    rows.push({ kind: 'event', key: event.id, event });
  }
  return rows;
}

/** "#foot" searches the tag, other text of 2+ characters the title, tags and categories. */
export function textSearch(text: string): Pick<EventSearch, 'q' | 'tag'> {
  const trimmed = text.trim();
  if (trimmed.startsWith('#')) {
    const tag = normaliseTag(trimmed);
    return tag.length >= 2 ? { tag } : {};
  }
  return trimmed.length >= 2 ? { q: trimmed.slice(0, 50) } : {};
}

/**
 * E1 Sorties, "Discover" (AC-3.1 to 3.6, 3.10): area selector, map placeholder and search;
 * category and date chips; filters sheet; results grouped by day, soonest first, loaded page
 * after page; loading, empty, error, offline and rate-limited states.
 */
export function DiscoverList({
  initialTag,
  guest = false,
  top,
  bottom,
}: {
  initialTag?: string;
  /** Guest mode (US-15): guest cards and states, no map button, "Tout Paris" sent as `paris`. */
  guest?: boolean;
  /** Above the search (the guest hero and the "Trouve une sortie" row); gets the badge opener. */
  top?: (openBadge: (ref: RefObject<View | null>) => void) => ReactNode;
  /** Under the results (the guest conversion card and footer). */
  bottom?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const account = useGuestAccount();
  const locale = resolveLocale(i18n.language);
  const router = useRouter();
  const { showToast } = useToast();
  const options = useEventOptions();

  const [areaLoaded, setAreaLoaded] = useState(false);
  // No arrondissement = "Tout Paris", the default (PM decision 2026-10-06).
  const [areas, setAreas] = useState<string[]>([]);
  const [radius, setRadius] = useState(0);
  const [areaSheet, setAreaSheetState] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  // Each opening mounts the sheet afresh (a new key), so it starts from the current values.
  const setAreaSheet = (open: boolean) => {
    if (open) setSheetKey((k) => k + 1);
    setAreaSheetState(open);
  };
  const [categories, setCategories] = useState<CategoryKey[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>(null);
  const [dateSheet, setDateSheet] = useState(false);
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [filterTag, setFilterTag] = useState('');
  const [language, setLanguage] = useState<EventLanguage | null>(null);
  const [filtersSheet, setFiltersSheetState] = useState(false);
  const setFiltersSheet = (open: boolean) => {
    if (open) setSheetKey((k) => k + 1);
    setFiltersSheetState(open);
  };
  const [text, setText] = useState(initialTag ? `#${initialTag}` : '');
  const [debounced, setDebounced] = useState(text);

  // AC-15.7: back from the account step, the search comes back with the guest's filters.
  const restore = useCallback((saved: SavedFilters | null) => {
    if (!saved) return;
    setCategories(saved.categories);
    setDateFilter(saved.date);
    setAgeBand(saved.ageBand);
    setFilterTag(saved.tag);
    setLanguage(saved.language);
    setText(saved.text);
    setDebounced(saved.text);
  }, []);
  useFocusEffect(useCallback(() => restore(takeRestoredFilters()), [restore]));
  useEffect(() => {
    if (guest)
      rememberFilters({
        categories,
        date: dateFilter,
        ageBand,
        tag: filterTag,
        language,
        text: debounced,
      });
  }, [guest, categories, dateFilter, ageBand, filterTag, language, debounced]);
  const [badgeOpener, setBadgeOpener] = useState<RefObject<View | null> | null>(null);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    void readArea().then((stored) => {
      setAreas(stored.areas);
      setRadius(stored.radius);
      setAreaLoaded(true);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const today = zonedToday(TIME_ZONE);
  const search: EventSearch = useMemo(() => {
    const typed = textSearch(debounced);
    const dates =
      dateFilter?.mode === 'today'
        ? { from: today, to: today }
        : dateFilter?.mode === 'weekend'
          ? weekendRange(today)
          : dateFilter?.mode === 'pick'
            ? { from: dateFilter.date, to: dateFilter.date }
            : {};
    return {
      area: areas.length ? areas : guest ? [ALL_PARIS] : undefined,
      radius_km: areas.length && radius ? radius : undefined,
      category: categories.length ? categories : undefined,
      ...dates,
      age_band: ageBand ?? undefined,
      tag: typed.tag ?? (filterTag || undefined),
      q: typed.q,
      language: language ?? undefined,
    };
  }, [
    areas,
    radius,
    categories,
    dateFilter,
    today,
    ageBand,
    filterTag,
    language,
    debounced,
    guest,
  ]);

  const query = useEventSearch(search, areaLoaded);
  const events = useMemo(
    () => query.data?.pages.flatMap((page) => page.events) ?? [],
    [query.data],
  );
  const rows = useMemo(
    () => groupByDay(events, (iso, tz) => formatLongDay(iso, tz, locale)),
    [events, locale],
  );

  // BUG-6: an empty page with a next page: fetch on, up to MAX_EMPTY_PAGES pages.
  const pageCount = query.data?.pages.length ?? 0;
  const autoFetching =
    events.length === 0 && Boolean(query.hasNextPage) && pageCount < MAX_EMPTY_PAGES;
  useEffect(() => {
    if (autoFetching && !query.isFetching && !query.isError) void query.fetchNextPage();
  }, [autoFetching, query]);

  // The distance counts only from chosen arrondissements ("Tout Paris" has no centre).
  const distance = areas.length ? radius : 0;
  const activeCount =
    categories.length +
    (dateFilter ? 1 : 0) +
    (distance > 0 ? 1 : 0) +
    (ageBand ? 1 : 0) +
    (filterTag ? 1 : 0) +
    (language ? 1 : 0);
  const filtering =
    activeCount > 0 || Boolean(textSearch(debounced).q || textSearch(debounced).tag);

  const changeAreas = useCallback(
    (keys: string[]) => {
      setAreas(keys);
      setAreaSheet(false);
      void saveArea({ areas: keys, radius });
    },
    [radius],
  );

  const changeRadius = useCallback(
    (km: number) => {
      setRadius(km);
      void saveArea({ areas, radius: km });
    },
    [areas],
  );

  const clearAll = () => {
    setCategories([]);
    setDateFilter(null);
    setAgeBand(null);
    setFilterTag('');
    setLanguage(null);
    setText('');
    setDebounced('');
    changeRadius(0);
  };

  // "Widen my area": the next distance step, then the area sheet once at the largest (or
  // at once on "Tout Paris", which has no distance).
  const widen = () => {
    const next = areas.length ? RADIUS_CHOICES.find((km) => km > radius) : undefined;
    if (next) changeRadius(next);
    else setAreaSheet(true);
  };

  const toggleCategory = (key: CategoryKey) =>
    setCategories((current) =>
      current.includes(key) ? current.filter((c) => c !== key) : [...current, key],
    );

  const openBadge = (ref: RefObject<View | null>) => {
    setBadgeOpener(ref);
  };

  const areaChip = areaSummary(areas, options.data?.areas, t);

  const error = query.error;
  const retry = (
    <Button
      variant="secondary"
      size="small"
      label={t('errors.tryAgain')}
      onPress={() => void query.refetch()}
      testID="events-retry"
    />
  );
  // Guests (design guest-home section 6): yellow notes for offline and too many searches
  // (also a blocked connection, 403 client_blocked), the error note for anything else.
  const guestNotice = !error ? null : error.code === 'rate_limited' ||
    error.code === 'client_blocked' ? (
    <Notification
      level="reminder"
      title={t('guest.states.rateTitle')}
      // A blocked connection lasts an hour (contract): no "wait a minute".
      caption={t(
        error.code === 'client_blocked' ? 'guest.states.blockedBody' : 'guest.states.rateBody',
      )}
      testID="events-rate-limited"
    />
  ) : error.isOffline ? (
    events.length > 0 ? (
      <Notification
        level="reminder"
        title={t('guest.states.offlineTitle')}
        caption={t('guest.states.offlineBody')}
        testID="events-offline"
      />
    ) : (
      <View
        testID="events-offline-empty"
        className="gap-sm rounded-lg border-[0.5px] border-border-soft bg-surface p-lg"
        style={{ boxShadow: shadows.card }}
      >
        <Text accessibilityRole="header" className="text-h3 text-ink">
          {t('guest.states.offlineEmptyTitle')}
        </Text>
        <Text className="text-body text-ink-2">{t('guest.states.offlineEmptyBody')}</Text>
        <View className="items-start">{retry}</View>
      </View>
    )
  ) : (
    <Notification
      level="error"
      title={t('guest.states.failTitle')}
      caption={t('guest.states.failBody')}
      action={retry}
      testID="events-error"
    />
  );
  const errorNotice = guest ? (
    guestNotice
  ) : error ? (
    error.code === 'rate_limited' ? (
      <Notification
        level="error"
        title={t('rateLimited.title')}
        caption={t('rateLimited.wait')}
        testID="events-rate-limited"
      />
    ) : (
      <Notification
        level="error"
        title={t('errors.unreachable.title')}
        caption={
          events.length > 0
            ? `${t('errors.unreachable.caption')} ${t('events.lastUpdated', {
                time: clockTime(query.dataUpdatedAt),
              })}`
            : t('errors.unreachable.caption')
        }
        action={
          <Button
            variant="secondary"
            size="small"
            label={t('errors.tryAgain')}
            onPress={() => void query.refetch()}
            testID="events-retry"
          />
        }
        testID="events-error"
      />
    )
  ) : null;

  const header = (
    <View className="gap-md pb-md">
      {top?.(openBadge)}
      <View className="flex-row items-center gap-sm">
        <Pressable
          testID="area-selector"
          accessibilityRole="button"
          accessibilityLabel={areaChip.a11y}
          onPress={() => setAreaSheet(true)}
          className="flex-row items-center gap-xs rounded-md border-[1.5px] border-ink-3 bg-surface px-md"
          style={{ height: SEARCH_HEIGHT }}
        >
          <Icon icon={MapPin} size={18} color="ink-2" />
          <Text className="shrink text-body font-medium text-ink" numberOfLines={1}>
            {areaChip.label}
          </Text>
          <Icon icon={ChevronDown} size={16} color="ink-2" />
        </Pressable>
        {guest ? null : (
          <Pressable
            testID="map-button"
            accessibilityRole="button"
            accessibilityLabel={t('events.map.label')}
            onPress={() => showToast(t('events.map.toast'))}
            className="items-center justify-center rounded-md border-[1.5px] border-ink-3 bg-surface"
            style={{ width: SEARCH_HEIGHT, height: SEARCH_HEIGHT }}
          >
            <Icon icon={Map} size={20} color="ink" />
            <View className="absolute -right-2 -top-2 rounded-pill bg-sunny-light px-1.5 py-0.5">
              <Text className="text-[10px] font-medium text-sunny-dark">
                {t('events.map.soon')}
              </Text>
            </View>
          </Pressable>
        )}
        <View
          className="flex-1 flex-row items-center rounded-md border-[0.5px] border-border-soft bg-surface pl-md"
          style={{ height: SEARCH_HEIGHT, boxShadow: shadows.modal }}
        >
          <Icon icon={Search} size={18} color="ink-2" />
          <TextInput
            ref={searchRef}
            testID="events-search"
            accessibilityLabel={t('events.search.label')}
            value={text}
            onChangeText={setText}
            placeholder={t('events.search.placeholder')}
            placeholderTextColor={colorValue('ink-3')}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            onSubmitEditing={() => setDebounced(text)}
            className="flex-1 px-sm text-ink"
            style={{ fontSize: parseFloat(fontSize.body[0]), paddingVertical: 0 }}
          />
          {text ? (
            <IconButton
              icon={X}
              color="ink-2"
              size={18}
              accessibilityLabel={t('events.search.clear')}
              onPress={() => {
                setText('');
                setDebounced('');
              }}
              testID="events-search-clear"
            />
          ) : null}
        </View>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={t('events.categories.label')}
        data={['all', ...CATEGORIES] as const}
        keyExtractor={(item) => item}
        contentContainerClassName="gap-sm py-1.5"
        renderItem={({ item }) =>
          item === 'all' ? (
            <FilterChip
              label={t('events.categories.all')}
              selected={categories.length === 0}
              onPress={() => setCategories([])}
              testID="category-all"
            />
          ) : (
            <FilterChip
              label={t(`events.categories.${item}`)}
              selected={categories.includes(item)}
              onPress={() => toggleCategory(item)}
              leading={<CategoryIcon category={item} icon={CATEGORY_ICON[item]} />}
              testID={`category-${item}`}
            />
          )
        }
      />

      <View
        accessibilityLabel={t('events.dates.label')}
        className="flex-row flex-wrap gap-sm py-1.5"
      >
        <FilterChip
          label={t('events.dates.today')}
          selected={dateFilter?.mode === 'today'}
          onPress={() => setDateFilter((d) => (d?.mode === 'today' ? null : { mode: 'today' }))}
          testID="date-today"
        />
        <FilterChip
          label={t('events.dates.weekend')}
          selected={dateFilter?.mode === 'weekend'}
          onPress={() => setDateFilter((d) => (d?.mode === 'weekend' ? null : { mode: 'weekend' }))}
          testID="date-weekend"
        />
        <FilterChip
          label={t('events.dates.pick')}
          icon={Calendar}
          selected={dateFilter?.mode === 'pick'}
          onPress={() => (dateFilter?.mode === 'pick' ? setDateFilter(null) : setDateSheet(true))}
          testID="date-pick"
        />
        <FilterChip
          label={t('events.filters.button')}
          icon={SlidersHorizontal}
          selected={distance > 0 || Boolean(ageBand) || Boolean(filterTag) || Boolean(language)}
          onPress={() => setFiltersSheet(true)}
          testID="filters-button"
        />
      </View>

      {activeCount > 0 ? (
        <View className="flex-row items-center justify-between">
          <Text className="text-caption text-ink-2" accessibilityLiveRegion="polite">
            {t('events.filters.active', { count: activeCount })}
          </Text>
          <TextLink label={t('events.filters.clearAll')} onPress={clearAll} testID="clear-all" />
        </View>
      ) : null}

      {errorNotice}
    </View>
  );

  const showSkeleton = (!areaLoaded || query.isPending || autoFetching) && !error;

  const guestEmpty = (
    <EmptyState
      title={t('guest.states.emptyTitle')}
      body={t('guest.states.emptyBody')}
      testID="events-empty"
    >
      <View className="self-stretch">
        <Button
          variant="module"
          module="events"
          size="large"
          label={
            filtering
              ? t('guest.states.clearFilters')
              : areas.length
                ? t('guest.states.seeAllParis')
                : t('guest.states.otherArea')
          }
          onPress={() =>
            filtering ? clearAll() : areas.length ? changeAreas([]) : setAreaSheet(true)
          }
          testID="empty-first-action"
        />
      </View>
      <View className="self-stretch">
        <Button
          variant="ghost"
          label={t('guest.createAccount')}
          onPress={() => account.signUp()}
          testID="empty-sign-up"
        />
      </View>
    </EmptyState>
  );

  const empty = showSkeleton ? (
    <View className="gap-md">
      <EventListSkeleton />
      {guest ? (
        <Text
          role="status"
          accessibilityLiveRegion="polite"
          className="text-center text-caption text-ink-2"
          testID="events-loading-caption"
        >
          {t('guest.states.loading')}
        </Text>
      ) : null}
    </View>
  ) : error ? null : guest ? (
    guestEmpty
  ) : filtering ? (
    <EmptyState
      title={t('events.empty.filteredTitle')}
      body={t('events.empty.filteredBody')}
      testID="events-empty-filtered"
    >
      <View className="self-stretch">
        <Button
          variant="module"
          module="events"
          size="large"
          label={t('events.empty.clearFilters')}
          onPress={clearAll}
        />
      </View>
      <TextLink label={t('events.create')} onPress={() => router.push('/events/new')} />
    </EmptyState>
  ) : (
    <EmptyState
      title={t('events.empty.nearbyTitle')}
      body={t('events.empty.nearbyBody')}
      testID="events-empty"
    >
      <View className="self-stretch">
        <Button
          variant="module"
          module="events"
          size="large"
          label={t('events.create')}
          onPress={() => router.push('/events/new')}
        />
      </View>
      <TextLink label={t('events.empty.widen')} onPress={widen} testID="widen-area" />
    </EmptyState>
  );

  return (
    <View className="flex-1">
      <FlatList
        testID="events-list"
        data={rows}
        keyExtractor={(row) => row.key}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerClassName="gap-md px-lg pb-3xl"
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage && !query.isError)
            void query.fetchNextPage();
        }}
        ListFooterComponent={
          <>
            {query.isFetchingNextPage ? (
              <View className="items-center py-md" style={{ minHeight: MIN_TOUCH_TARGET }}>
                <ActivityIndicator color={colorValue('green-dark')} />
              </View>
            ) : null}
            {bottom && !showSkeleton ? <View className="gap-xl pt-xl">{bottom}</View> : null}
          </>
        }
        renderItem={({ item }) =>
          item.kind === 'day' ? (
            <Text accessibilityRole="header" className="pt-sm text-label uppercase text-ink-2">
              {item.label}
            </Text>
          ) : (
            <EventCard
              event={item.event}
              onPress={() => router.push(`/events/${item.event.id}`)}
              onBadgePress={openBadge}
            />
          )
        }
      />

      <AreaSheet
        key={`area-${sheetKey}`}
        visible={areaSheet}
        areas={options.data?.areas}
        current={areas}
        guest={guest}
        onApply={changeAreas}
        onClose={() => setAreaSheet(false)}
      />
      <FiltersSheet
        key={`filters-${sheetKey}`}
        visible={filtersSheet}
        value={{ radius: distance, ageBand, tag: filterTag, language }}
        withDistance={areas.length > 0}
        onApply={(filters: SheetFilters) => {
          changeRadius(filters.radius);
          setAgeBand(filters.ageBand);
          setFilterTag(filters.tag);
          setLanguage(filters.language);
          setFiltersSheet(false);
        }}
        onClose={() => setFiltersSheet(false)}
      />
      <DateSheet
        visible={dateSheet}
        today={today}
        selected={dateFilter?.mode === 'pick' ? dateFilter.date : null}
        onPick={(date) => {
          setDateFilter({ mode: 'pick', date });
          setDateSheet(false);
        }}
        onClose={() => setDateSheet(false)}
      />
      <BadgeSheet
        verified
        hosts={guest}
        visible={Boolean(badgeOpener)}
        onClose={() => setBadgeOpener(null)}
        returnFocusTo={badgeOpener ?? undefined}
      />
    </View>
  );
}
