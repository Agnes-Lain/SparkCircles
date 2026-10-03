import { Check, CircleAlert } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { shadows } from '../theme/colors';
import { Icon } from './Icon';

export type ToastKind = 'success' | 'error';

/**
 * Toast (design system section 9): Surface, radius-lg, 12/16 padding, Level 3 shadow, Body
 * Ink with a leading 20 px icon (green-dark check, or error-dark alert-circle).
 */
export function Toast({ message, kind = 'success' }: { message: string; kind?: ToastKind }) {
  return (
    <View
      className="flex-row items-center gap-sm rounded-lg bg-surface px-lg py-md"
      style={{ boxShadow: shadows.float }}
    >
      <Icon
        icon={kind === 'success' ? Check : CircleAlert}
        size={20}
        color={kind === 'success' ? 'green-dark' : 'error-dark'}
      />
      <Text className="flex-1 text-body text-ink">{message}</Text>
    </View>
  );
}
