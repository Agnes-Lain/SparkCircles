import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Animated, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { Toast, type ToastKind } from './Toast';

export const TOAST_DURATION_MS = 3000;
// Room for the tab bar (container, padding and its own bottom inset) when it is shown.
const TAB_BAR_CLEARANCE = 80;

type ToastMessage = { id: number; message: string; kind: ToastKind };

type ToastContextValue = {
  /** Shows a 3 s toast at the bottom of the screen, above the tab bar. */
  showToast(message: string, kind?: ToastKind): void;
  /** Asks the next screen to play the success checkmark (email confirmed, design S3). */
  celebrate(): void;
  /** Consumed by the screen that shows the checkmark. */
  takeCelebration(): boolean;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>.');
  return value;
}

/**
 * Holds the current toast and renders it over every screen. Toasts are announced to screen
 * readers (VoiceOver through announceForAccessibility, TalkBack through a polite live
 * region) and appear without animation when the user reduces motion.
 */
export function ToastProvider({
  children,
  aboveTabBar = false,
}: {
  children: ReactNode;
  aboveTabBar?: boolean;
}) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const celebration = useRef(false);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    nextId.current += 1;
    setToast({ id: nextId.current, message, kind });
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, []);

  const celebrate = useCallback(() => {
    celebration.current = true;
  }, []);

  const takeCelebration = useCallback(() => {
    const value = celebration.current;
    celebration.current = false;
    return value;
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(
    () => ({ showToast, celebrate, takeCelebration }),
    [showToast, celebrate, takeCelebration],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} aboveTabBar={aboveTabBar} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, aboveTabBar }: { toast: ToastMessage; aboveTabBar: boolean }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  // Shown once the system says whether motion is allowed (a moment after mount): at once
  // under reduced motion, otherwise with a 200 ms fade and rise.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [reduceMotion, progress]);

  const bottom = insets.bottom + (aboveTabBar ? TAB_BAR_CLEARANCE : 16);
  return (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0 px-lg"
      style={{ bottom }}
      accessibilityLiveRegion="polite"
      testID="toast"
    >
      <Animated.View
        style={{
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        }}
      >
        <Toast message={toast.message} kind={toast.kind} />
      </Animated.View>
    </View>
  );
}
