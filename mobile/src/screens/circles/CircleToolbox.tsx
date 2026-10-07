import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { MemberCircle } from '../../api/circles';
import { SettingsList } from '../../components/SettingsList';
import { circleTools } from './circleTools';

/**
 * « Outils du cercle » (PM decision 2026-10-07, option A): the Settings list, one row per
 * entry of `circleTools`. `verified`: my identity is checked.
 */
export function CircleToolbox({ circle, verified }: { circle: MemberCircle; verified: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <SettingsList
      roomy
      title={t('circles.detail.tools')}
      testID="circle-tools"
      items={circleTools(circle, verified, t).map(({ href, tone, ...tool }) => ({
        ...tool,
        iconTone: tone,
        onPress: href ? () => router.push(href) : undefined,
        testID: `tool-${tool.key}`,
      }))}
    />
  );
}
