import { CalendarHeart, Sparkles, UserCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { ReturnTarget } from '../../auth/returnTo';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { IconSquare } from '../../components/IconSquare';
import { useGuestAccount } from './useGuestAccount';

/** What the guest tried to do (design guest-home section 4, one title per action). */
export type GuestAction = 'join' | 'create' | 'report' | 'wishlist' | 'verifiedOnly';

/**
 * Sign-up prompt (AC-15.5), shown at the moment a guest acts, never before: the event title
 * as the eyebrow, the title for the action, what an account allows, the promise to come back
 * to this event (AC-15.7; the verified-only variant says verification comes next, AC-15.8),
 * then "Créer mon compte" and "J'ai déjà un compte". Closing it loses nothing.
 */
export function GuestSignUpSheet({
  visible,
  action,
  eventTitle,
  target,
  onClose,
}: {
  visible: boolean;
  action: GuestAction;
  /** The event the guest is on (none for "create"). */
  eventTitle?: string | null;
  /** Where to come back to after the account step. */
  target: ReturnTarget;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const account = useGuestAccount();
  const onEvent = Boolean(target.event);
  const go = (to: 'signUp' | 'logIn') => {
    onClose();
    account[to](target);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="guest-sign-up-sheet">
      <View className="gap-xs">
        {eventTitle && action !== 'create' ? (
          <Text className="text-label uppercase text-ink-2" numberOfLines={1}>
            {eventTitle}
          </Text>
        ) : null}
        <Text accessibilityRole="header" className="text-h2 text-ink">
          {t(`guest.sheet.${action}`)}
        </Text>
      </View>
      <View className="gap-sm" accessibilityLabel={t('guest.sheet.canTitle')}>
        <Text className="text-body font-medium text-ink">{t('guest.sheet.canTitle')}</Text>
        {(
          [
            [Sparkles, 'canJoin'],
            [UserCheck, 'canHost'],
            [CalendarHeart, 'canFind'],
          ] as const
        ).map(([icon, key]) => (
          <View key={key} className="flex-row items-center gap-md">
            <IconSquare icon={icon} tone="verification" />
            <Text className="flex-1 text-body text-ink">{t(`guest.sheet.${key}`)}</Text>
          </View>
        ))}
      </View>
      {onEvent ? (
        <View accessible className="rounded-lg bg-green-light px-lg py-md" testID="return-promise">
          <Text className="text-note-title text-ink">{t('guest.sheet.promiseTitle')}</Text>
          {action === 'join' || action === 'verifiedOnly' ? (
            <Text className="text-caption text-green-dark">
              {action === 'verifiedOnly'
                ? t('guest.sheet.promiseVerify')
                : t('guest.sheet.promiseJoin')}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View className="gap-sm">
        <Button
          size="large"
          label={t('guest.createAccount')}
          onPress={() => go('signUp')}
          testID="guest-sheet-sign-up"
        />
        <Button
          variant="ghost"
          label={t('guest.haveAccount')}
          onPress={() => go('logIn')}
          testID="guest-sheet-log-in"
        />
      </View>
    </BottomSheet>
  );
}
