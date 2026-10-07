import { useRouter } from 'expo-router';
import { ChevronDown, MapPin, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { PublicCircle } from '../../api/circles';
import { useMe } from '../../auth/useMe';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { Notification } from '../../components/Notification';
import { TextField } from '../../components/TextField';
import { AreaSheet, areaSummary } from '../events/AreaSheet';
import { useEventOptions } from '../events/queries';
import { CardsSkeleton, CommunityCard, FamiliesLine } from './CircleParts';
import { useCircleSearch } from './queries';

const Q_MIN = 2;
const DEBOUNCE_MS = 400;

/**
 * C8 "Trouver un cercle" (AC-17.8 to AC-17.10, design 8a to 8g): the area chip ("Tout
 * Paris" by default, multi-select as in Events), the name or description field (2
 * characters at least, nothing is sent below), public circle cards, "Voir plus". No total
 * count anywhere. Guests search too; their area stays on the phone (it is never saved).
 */
export function FindCircles({ guest }: { guest: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe();
  const options = useEventOptions();
  const [areas, setAreas] = useState<string[]>([]);
  const [areaSheet, setAreaSheet] = useState(0);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const trimmed = text.trim();
    const next = trimmed.length >= Q_MIN ? trimmed : '';
    const timer = setTimeout(() => setQ(next), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const query = useCircleSearch({ area: areas, q: q || undefined }, true);
  const circles = query.data?.pages.flatMap((page) => page.circles) ?? [];
  const chip = areaSummary(areas, options.data?.areas, t);
  const rateLimited =
    query.error?.code === 'rate_limited' || query.error?.code === 'client_blocked';
  const verified = me.data?.verification.verified ?? false;
  const filtered = areas.length > 0 || q !== '';

  let results;
  if (!query.data && query.isPending) {
    results = <CardsSkeleton label={t('circles.search.loading')} />;
  } else if (rateLimited) {
    results = (
      <Notification
        level="reminder"
        title={t('circles.search.rateTitle')}
        caption={t('circles.search.rateBody')}
        action={
          <Button
            variant="secondary"
            size="small"
            label={t('circles.search.rateCta')}
            onPress={() => void query.refetch()}
          />
        }
        testID="search-rate-limited"
      />
    );
  } else if (query.error && !query.data) {
    results = (
      <Notification
        level="error"
        title={t('circles.search.error')}
        action={
          <Button
            variant="secondary"
            size="small"
            label={t('errors.tryAgain')}
            onPress={() => void query.refetch()}
          />
        }
        testID="search-error"
      />
    );
  } else if (circles.length === 0) {
    results = (
      <EmptyState
        module="community"
        emoji="🏡"
        title={t('circles.search.emptyTitle')}
        body={t('circles.search.emptyBody')}
        testID="search-empty"
      >
        {guest ? null : verified ? (
          <>
            <Button
              variant="module"
              module="community"
              label={t('circles.create')}
              onPress={() => router.push('/circles/new')}
            />
            <Button
              variant="ghost"
              label={t('circles.haveCode')}
              onPress={() => router.push('/circles/code')}
            />
          </>
        ) : (
          <>
            <Button
              variant="module"
              module="community"
              label={t('circles.haveCode')}
              onPress={() => router.push('/circles/code')}
            />
            <Button
              variant="ghost"
              label={t('circles.verifyToCreate.cta')}
              onPress={() => router.push('/verify')}
            />
          </>
        )}
      </EmptyState>
    );
  } else {
    results = (
      <>
        {filtered ? (
          <Text className="text-caption text-ink-3">{t('circles.search.sorted')}</Text>
        ) : null}
        {circles.map((circle) => (
          <ResultCard
            key={circle.id}
            circle={circle}
            onPress={() => router.push(`/circles/${circle.id}`)}
          />
        ))}
        {query.hasNextPage ? (
          <Button
            variant="ghost"
            label={t('circles.search.seeMore')}
            loading={query.isFetchingNextPage}
            onPress={() => void query.fetchNextPage()}
            testID="search-more"
          />
        ) : null}
      </>
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-md px-lg pb-3xl"
      testID="find-circles"
    >
      <View className="items-start">
        <Pressable
          testID="circle-area-selector"
          accessibilityRole="button"
          accessibilityLabel={chip.a11y}
          onPress={() => setAreaSheet((k) => k + 1)}
          className="flex-row items-center gap-xs rounded-md border-[1.5px] border-ink-3 bg-surface px-md"
          style={{ height: 48 }}
        >
          <Icon icon={MapPin} size={18} color="ink-2" />
          <Text className="shrink text-body font-medium text-ink" numberOfLines={1}>
            {areas.length ? chip.label : t('circles.search.allParis')}
          </Text>
          <Icon icon={ChevronDown} size={16} color="ink-2" />
        </Pressable>
      </View>
      <TextField
        label={t('circles.search.label')}
        placeholder={t('circles.search.placeholder')}
        value={text}
        onChangeText={setText}
        leading={<Icon icon={Search} size={18} color="ink-2" />}
        returnKeyType="search"
        testID="circle-search-text"
      />
      {guest ? (
        <Text className="text-caption text-ink-2">{t('circles.search.guestCaption')}</Text>
      ) : null}
      {results}
      {areaSheet ? (
        <AreaSheet
          key={areaSheet}
          visible
          areas={options.data?.areas}
          current={areas}
          guest={guest}
          applyLabel={t('circles.search.showCircles')}
          onApply={(keys) => {
            setAreas(keys);
            setAreaSheet(0);
          }}
          onClose={() => setAreaSheet(0)}
        />
      ) : null}
    </ScrollView>
  );
}

/** Result card (design 8a): name, description on 2 lines, families · district, badges. */
function ResultCard({ circle, onPress }: { circle: PublicCircle; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={circle.name}
      onPress={onPress}
      testID={`circle-result-${circle.id}`}
    >
      <CommunityCard>
        <Text className="text-h3 text-ink">{circle.name}</Text>
        {circle.description ? (
          <Text className="text-body text-ink-2" numberOfLines={2}>
            {circle.description}
          </Text>
        ) : null}
        <FamiliesLine count={circle.families_count} area={circle.area.label} />
        <View className="flex-row flex-wrap gap-xs">
          <Badge kind="badge-sky" label={t('circles.public.label')} />
          <Badge kind="badge-green" label={t('circles.public.runBy')} />
          {circle.full ? <Badge kind="badge-neutral" label={t('circles.public.full')} /> : null}
          {circle.viewer.status === 'pending' ? (
            <Badge kind="badge-yellow" label={t('circles.pending')} />
          ) : null}
          {circle.viewer.status === 'member' ? (
            <Badge kind="badge-sky" label={t('circles.role.member')} />
          ) : null}
        </View>
      </CommunityCard>
    </Pressable>
  );
}
