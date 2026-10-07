import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, UserMinus, UserRoundCog } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import type { CircleMember, MemberCircle } from '../../api/circles';
import type { ApiError } from '../../api/errors';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/ToastProvider';
import { MIN_TOUCH_TARGET } from '../../theme/a11y';
import { VerifiedBadge } from './CircleParts';
import { displayName, storeCircle } from './queries';

// Shared by the circle detail (C5) and its « Membres » tool: sheet rows and member actions.

export function SheetAction({
  icon,
  label,
  onPress,
  destructive = false,
  testID,
}: {
  icon: typeof Flag;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-md"
      style={{ minHeight: MIN_TOUCH_TARGET + 8 }}
    >
      <Icon icon={icon} size={20} color={destructive ? 'error-dark' : 'ink-2'} />
      <Text className={`text-body font-medium ${destructive ? 'text-error-dark' : 'text-ink'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function DestructiveLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="items-center justify-center"
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      <Text className="text-body font-medium text-error-dark underline">{label}</Text>
    </Pressable>
  );
}

/** A member action that answers with the circle: stored, toast, sheet closed. */
export function useCircleAction<V>(
  { close, onFail }: { close: () => void; onFail: (error: ApiError) => void },
  fn: (v: V) => Promise<{ circle: MemberCircle }>,
  toast: (v: V) => string,
) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation<{ circle: MemberCircle }, ApiError, V>({
    mutationFn: fn,
    onSuccess: (data, v) => {
      close();
      storeCircle(queryClient, data.circle);
      showToast(toast(v));
    },
    onError: onFail,
  });
}

/** C5d Member options (design 5d): co-admin, report, remove; step down on my own row. */
export function MemberOptions({
  member,
  circle,
  admins,
  onPromote,
  onRemove,
  onReport,
  onStepDown,
}: {
  member: CircleMember;
  circle: MemberCircle;
  admins: number;
  onPromote: () => void;
  onRemove: () => void;
  onReport: () => void;
  onStepDown: () => void;
}) {
  const { t } = useTranslation();
  const manage = circle.can.manage;
  return (
    <View className="gap-xs">
      <View className="flex-row items-center gap-sm pb-sm">
        <Avatar name={member.first_name} seed={member.id} size="md" />
        <Text className="flex-1 text-h3 text-ink">{displayName(member)}</Text>
        <VerifiedBadge verified={member.verified} />
      </View>
      {member.me ? (
        <SheetAction
          icon={UserRoundCog}
          label={t('circles.detail.stepDown')}
          onPress={onStepDown}
          testID="step-down"
        />
      ) : (
        <>
          {manage && member.role === 'member' ? (
            member.verified && admins < 3 ? (
              <SheetAction
                icon={UserRoundCog}
                label={t('circles.detail.makeCoAdmin')}
                onPress={onPromote}
                testID="make-co-admin"
              />
            ) : (
              <View
                style={{ minHeight: MIN_TOUCH_TARGET }}
                className="justify-center"
                testID="co-admin-unavailable"
              >
                <Text className="text-body text-ink-3">{t('circles.detail.makeCoAdmin')}</Text>
                <Text className="text-caption text-ink-3">
                  {member.verified
                    ? t('circles.detail.adminMax')
                    : t('circles.detail.notVerifiedYet')}
                </Text>
              </View>
            )
          ) : null}
          <SheetAction
            icon={Flag}
            label={t('circles.detail.reportMember')}
            onPress={onReport}
            testID="report-member"
          />
          {manage && member.role === 'member' && !member.creator ? (
            <SheetAction
              icon={UserMinus}
              destructive
              label={t('circles.detail.remove')}
              onPress={onRemove}
              testID="remove-member"
            />
          ) : null}
        </>
      )}
    </View>
  );
}
