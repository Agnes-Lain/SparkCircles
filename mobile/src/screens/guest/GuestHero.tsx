import { ShieldCheck, Sparkles, Users } from 'lucide-react-native';
import { type ReactNode, type RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { IconSquare } from '../../components/IconSquare';
import { TextLink } from '../../components/TextLink';
import { Wordmark } from '../../components/Wordmark';
import { shadows } from '../../theme/colors';
import { useGuestAccount } from './useGuestAccount';

/** The top row of every guest screen: Ripple lockup 36 px, "Me connecter" on the right. */
export function GuestTopRow() {
  const { t } = useTranslation();
  const account = useGuestAccount();
  return (
    <View className="min-h-11 flex-row items-center justify-between">
      <Wordmark height={36} />
      <TextLink
        label={t('guest.logIn')}
        onPress={() => account.logIn()}
        testID="guest-log-in-link"
      />
    </View>
  );
}

function Benefit({
  icon,
  tone,
  title,
  body,
  children,
  last = false,
}: {
  icon: typeof Sparkles;
  tone: 'verification' | 'sky';
  title: string;
  body: string;
  children?: ReactNode;
  last?: boolean;
}) {
  return (
    <View
      role="listitem"
      className={`flex-row items-start gap-md py-md ${last ? '' : 'border-b-[0.5px] border-border-soft'}`}
    >
      <IconSquare icon={icon} tone={tone} />
      <View className="flex-1 gap-xs">
        <Text className="text-h3 text-ink">{title}</Text>
        <Text className="text-caption text-ink-2">{body}</Text>
        {children}
      </View>
    </View>
  );
}

/**
 * Guest hero (design guest-home sections 3 and 3b) on top of Sorties in guest mode; it
 * scrolls away with the list. Full: the promise, the support line, the benefits card and the
 * two account actions. Compact (a device that has seen the full hero): the promise on one
 * line and both actions stacked full width, as in GuestTabScreen. One Primary either way.
 */
export function GuestHero({
  compact,
  onVerifyInfo,
}: {
  compact: boolean;
  /** Opens "Ce que veut dire « vérifié »" (AC-15.14), focus returns to the link. */
  onVerifyInfo: (ref: RefObject<View | null>) => void;
}) {
  const { t } = useTranslation();
  const account = useGuestAccount();
  const linkRef = useRef<View>(null);

  if (compact) {
    return (
      <View className="gap-md pb-xl pt-sm" testID="guest-hero-compact">
        <GuestTopRow />
        <Text accessibilityRole="header" className="text-body font-medium text-ink">
          {t('guest.hero.promise')}
        </Text>
        <View className="gap-sm" testID="hero-compact-actions">
          <Button
            size="large"
            label={t('guest.createAccount')}
            onPress={() => account.signUp()}
            testID="hero-sign-up"
          />
          <Button
            variant="ghost"
            label={t('guest.haveAccount')}
            onPress={() => account.logIn()}
            testID="hero-log-in"
          />
        </View>
      </View>
    );
  }

  return (
    <View className="gap-xl pb-xl pt-sm" testID="guest-hero">
      <GuestTopRow />
      <View className="gap-md">
        <Text accessibilityRole="header" className="text-h1 text-ink">
          {t('guest.hero.promise')}
        </Text>
        <Text className="text-body text-ink-2">{t('guest.hero.support')}</Text>
      </View>
      <View
        role="list"
        accessibilityLabel={t('guest.hero.benefits')}
        className="rounded-lg border-[0.5px] border-border-soft bg-surface px-lg"
        style={{ boxShadow: shadows.card }}
      >
        <Benefit
          icon={Sparkles}
          tone="verification"
          title={t('guest.hero.findTitle')}
          body={t('guest.hero.findBody')}
        />
        <Benefit
          icon={ShieldCheck}
          tone="verification"
          title={t('guest.hero.verifiedTitle')}
          body={t('guest.hero.verifiedBody')}
        >
          <View className="-my-sm self-start">
            <TextLink
              ref={linkRef}
              small
              label={t('guest.hero.verifiedLink')}
              onPress={() => onVerifyInfo(linkRef)}
              testID="hero-verified-link"
            />
          </View>
        </Benefit>
        <Benefit
          icon={Users}
          tone="sky"
          title={t('guest.hero.togetherTitle')}
          body={t('guest.hero.togetherBody')}
          last
        >
          <View className="self-start">
            <Badge kind="badge-yellow" label={t('guest.hero.soon')} />
          </View>
        </Benefit>
      </View>
      <View className="gap-sm">
        <Button
          size="large"
          label={t('guest.createAccount')}
          onPress={() => account.signUp()}
          testID="hero-sign-up"
        />
        <Button
          variant="ghost"
          label={t('guest.haveAccount')}
          onPress={() => account.logIn()}
          testID="hero-log-in"
        />
        <Text className="text-center text-caption text-ink-2">{t('guest.hero.noAccount')}</Text>
      </View>
    </View>
  );
}
