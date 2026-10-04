import { X } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, PanResponder, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { shadows } from '../theme/colors';
import { IconButton } from './IconButton';

/** How far the sheet must be dragged down before it closes (swipe down to close). */
const SWIPE_CLOSE_DISTANCE = 80;

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Leading element on the close button's row (e.g. the B1 icon square). */
  leading?: ReactNode;
  children: ReactNode;
  testID?: string;
};

/**
 * Bottom sheet (design system section 10): Surface, radius-xl top corners, Level 2 shadow,
 * 24/16/48 padding, Scrim behind. Closes with the 44 px `x` button ("Close"), a tap on the
 * scrim, a swipe down, Android back, or the sheet's own action. Screen readers stay inside
 * the sheet (modal). Slides in, or appears at once under reduced motion.
 */
export function BottomSheet({ visible, onClose, leading, children, testID }: BottomSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [dragY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) dragY.setValue(0);
  }, [visible, dragY]);

  // Swipe down with the core PanResponder (no gesture package).
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > SWIPE_CLOSE_DISTANCE) onClose();
          else Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [dragY, onClose],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion === false ? 'slide' : 'none'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        <Pressable
          testID={testID ? `${testID}-scrim` : 'sheet-scrim'}
          accessible={false}
          importantForAccessibility="no"
          onPress={onClose}
          className="absolute inset-0 bg-scrim"
        />
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          {...pan.panHandlers}
          className="gap-lg rounded-t-xl bg-surface px-lg pt-xl"
          style={{
            paddingBottom: Math.max(48, insets.bottom + 16),
            boxShadow: shadows.modal,
            transform: [{ translateY: dragY }],
          }}
        >
          <View className="flex-row items-start justify-between">
            {leading ?? <View />}
            <View className="-mr-3 -mt-2">
              <IconButton icon={X} accessibilityLabel={t('common.close')} onPress={onClose} />
            </View>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
