import { Check, ShieldCheck, Shield, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Badge } from '../../components/Badge';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { IconSquare } from '../../components/IconSquare';

/**
 * B1 Badge explanation sheet (AC-8.2, 8.3). "Not verified" never says why (pending,
 * rejected or expired stay private, AC-8.2).
 */
export function BadgeSheet({
  verified,
  visible,
  onClose,
}: {
  verified: boolean;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      testID="badge-sheet"
      leading={
        <IconSquare
          large
          icon={verified ? ShieldCheck : Shield}
          tone={verified ? 'verification' : 'neutral'}
        />
      }
    >
      <View className="gap-xs">
        <Text accessibilityRole="header" className="text-h2 text-ink">
          {verified ? t('badgeSheet.verifiedTitle') : t('badgeSheet.notVerifiedTitle')}
        </Text>
        <Text className="text-body text-ink-2">
          {verified ? t('badgeSheet.verifiedBody') : t('badgeSheet.notVerifiedBody')}
        </Text>
      </View>
      {verified ? (
        <>
          <View className="gap-sm">
            <View className="flex-row items-start gap-sm">
              <Icon icon={Check} color="green-dark" />
              <Text className="flex-1 text-body text-ink">{t('badgeSheet.match')}</Text>
            </View>
            <View className="flex-row items-start gap-sm">
              <Icon icon={X} color="ink-2" />
              <Text className="flex-1 text-body text-ink">{t('badgeSheet.notCriminal')}</Text>
            </View>
          </View>
          <Text className="text-caption text-ink-3">{t('badgeSheet.judgment')}</Text>
        </>
      ) : null}
      <Button size="large" label={t('badgeSheet.gotIt')} onPress={onClose} testID="got-it" />
    </BottomSheet>
  );
}

/** The public verification badge (AC-8.1): "Verified ✓" or "Not verified", opens B1. */
export function PublicBadge({ verified, onPress }: { verified: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return verified ? (
    <Badge
      kind="badge-green"
      label={t('badge.verified')}
      accessibilityLabel={t('badge.verifiedA11y')}
      onPress={onPress}
      testID="badge"
    />
  ) : (
    <Badge
      kind="badge-neutral"
      label={t('badge.notVerified')}
      accessibilityLabel={t('badge.opensExplanation', { status: t('badge.notVerified') })}
      onPress={onPress}
      testID="badge"
    />
  );
}
