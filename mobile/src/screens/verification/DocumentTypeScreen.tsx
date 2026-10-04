import { useRouter } from 'expo-router';
import { IdCard } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import type { DocumentType } from '../../api/verification';
import { Header } from '../../components/Header';
import { SettingsList } from '../../components/SettingsList';
import { FormScreen } from '../auth/layouts';
import { useBack } from '../auth/useBack';
import { DOCUMENT_TYPES, useVerificationFlow } from './flow';

/**
 * V1 Which document do you have? (AC-7.3, 7.4). One tap picks the document and starts the
 * capture; it also tells the app whether to ask for a back side.
 */
export function DocumentTypeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/verify');
  const flow = useVerificationFlow();

  const caption = (type: DocumentType) => {
    if (type === 'passport') return t('verify.document.passportCaption');
    if (type === 'residence_permit') return t('verify.document.residencePermitCaption');
    return t('verify.document.frontAndBack');
  };

  const choose = (type: DocumentType) => {
    flow.chooseDocument(type);
    router.push({ pathname: '/verify/capture', params: { side: 'front' } });
  };

  return (
    <FormScreen testID="verify-document">
      <Header
        title={t('verify.document.title')}
        onBack={back}
        step={t('verify.step', { step: 1 })}
      />
      <SettingsList
        items={DOCUMENT_TYPES.map((type) => ({
          key: type,
          icon: IdCard,
          label: t(`verify.document.name.${type}`),
          caption: caption(type),
          onPress: () => choose(type),
          testID: `document-${type}`,
        }))}
      />
      <Text className="text-caption text-ink-3">{t('verify.document.hint')}</Text>
    </FormScreen>
  );
}
