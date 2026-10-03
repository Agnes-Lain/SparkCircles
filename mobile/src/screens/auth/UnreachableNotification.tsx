import { useTranslation } from 'react-i18next';

import { Button } from '../../components/Button';
import { Notification } from '../../components/Notification';

/**
 * The designed network / server error banner: "We couldn't reach SparkCircles" / "Check your
 * connection and try again." with a Small Secondary "Try again" (design section 3).
 */
export function UnreachableNotification({
  onRetry,
  retrying = false,
}: {
  onRetry: () => void;
  retrying?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Notification
      level="error"
      testID="unreachable"
      title={t('errors.unreachable.title')}
      caption={t('errors.unreachable.caption')}
      action={
        <Button
          label={t('errors.tryAgain')}
          variant="secondary"
          size="small"
          loading={retrying}
          onPress={onRetry}
        />
      }
    />
  );
}
