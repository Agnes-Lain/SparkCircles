import { useRouter } from 'expo-router';
import {
  Camera,
  ChevronLeft,
  Clock,
  IdCard,
  type LucideIcon,
  ShieldCheck,
} from 'lucide-react-native';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useMe } from '../../auth/useMe';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { HeaderIconButton } from '../../components/HeaderIconButton';
import { IconSquare } from '../../components/IconSquare';
import { SectionLabel } from '../../components/SettingsList';
import { FormScreen } from '../auth/layouts';
import { useBack } from '../auth/useBack';
import { PrivacyNote } from './PrivacyNote';

/**
 * V0 Verify to host (mockup `verify-gate`, AC-7.1, 7.2, 7.5). Reached from the A1 card until
 * Events exists. A parent whose verification is pending sees the pending variant: they
 * can't send a second one (AC-7.5).
 */
export function VerifyGateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/account');
  const verification = useMe().data?.verification;
  const pending = verification?.status === 'pending' || verification?.renewal?.status === 'pending';

  if (pending) {
    return (
      <FormScreen testID="verify-gate-pending">
        <BackRow onBack={back} />
        <View className="items-start gap-lg">
          <Badge kind="badge-yellow" label={t('badge.pending')} />
          <Text accessibilityRole="header" className="text-h1 text-ink">
            {t('verify.gate.pendingTitle')}
          </Text>
          <Text className="text-body text-ink-2">{t('verify.gate.pendingBody')}</Text>
        </View>
        <Button size="large" label={t('common.ok')} onPress={back} testID="verify-gate-ok" />
      </FormScreen>
    );
  }

  const needs: [string, LucideIcon, string][] = [
    ['document', IdCard, t('verify.gate.needDocument')],
    ['selfie', Camera, t('verify.gate.needSelfie')],
    ['time', Clock, t('verify.gate.needTime')],
  ];

  return (
    <FormScreen testID="verify-gate">
      <BackRow onBack={back} />
      <View className="gap-lg">
        <View className="h-14 w-14 items-center justify-center rounded-lg bg-green-light">
          <Icon icon={ShieldCheck} size={28} color="green-dark" />
        </View>
        <Text accessibilityRole="header" className="text-h1 text-ink">
          {t('verify.gate.title')}
        </Text>
        <Text className="text-body text-ink-2">{t('verify.gate.body')}</Text>
      </View>

      <View className="gap-md rounded-lg border-[0.5px] border-border-soft bg-surface p-lg">
        <SectionLabel>{t('verify.gate.needTitle')}</SectionLabel>
        {needs.map(([key, icon, label], index) => (
          <Fragment key={key}>
            {index > 0 ? <View className="h-[0.5px] bg-border-soft" /> : null}
            <View accessible className="flex-row items-center gap-md">
              <IconSquare icon={icon} />
              <Text className="flex-1 text-body text-ink">{label}</Text>
            </View>
          </Fragment>
        ))}
      </View>

      <PrivacyNote />

      <View className="gap-md">
        <Button
          size="large"
          label={t('verify.gate.start')}
          onPress={() => router.push('/verify/document')}
          testID="verify-start"
        />
        <Button variant="ghost" size="large" label={t('verify.gate.notNow')} onPress={back} />
      </View>
    </FormScreen>
  );
}

function BackRow({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row">
      <HeaderIconButton icon={ChevronLeft} accessibilityLabel={t('common.back')} onPress={onBack} />
    </View>
  );
}
