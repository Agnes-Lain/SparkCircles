import { X } from 'lucide-react-native';
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Animated,
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { shadows } from '../theme/colors';
import { IconButton } from './IconButton';

/** How far the sheet must be dragged down before it closes (swipe down to close). */
const SWIPE_CLOSE_DISTANCE = 80;
/** Time for the modal to leave (its slide-out) before focus goes back to the opener. */
const RETURN_FOCUS_DELAY = { animated: 350, still: 50 };
/** Gap kept between the status bar (top safe area) and the top of the sheet. */
export const SHEET_TOP_MARGIN = 12;
/** Space kept under a focused field when the sheet scrolls it above the keyboard. */
const FOCUSED_FIELD_MARGIN = 24;

/** The tallest a sheet may be: the screen minus the top safe area and a small margin. */
export function sheetMaxHeight(windowHeight: number, topInset: number) {
  return windowHeight - topInset - SHEET_TOP_MARGIN;
}

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Leading element on the close button's row (e.g. the B1 icon square). */
  leading?: ReactNode;
  /** The control that opened the sheet: the screen reader's focus returns to it on close. */
  returnFocusTo?: RefObject<View | null>;
  /**
   * Sticky footer under the scrolling content (the sheet's primary action): it stays visible
   * and rises above the keyboard, so the CTA is always reachable.
   */
  footer?: ReactNode;
  children: ReactNode;
  testID?: string;
};

/**
 * Bottom sheet (design system section 10): Surface, radius-xl top corners, Level 2 shadow,
 * 24/16/48 padding, Scrim behind. Closes with the 44 px `x` button ("Close"), a tap on the
 * scrim, a swipe down, Android back, or the sheet's own action. Screen readers stay inside
 * the sheet (modal), and their focus returns to the opener when it closes (design section 5).
 * Slides in, or appears at once under reduced motion.
 *
 * Never taller than the screen minus the top safe area (the title stays below the status
 * bar). The content scrolls, and the sheet rises above the keyboard with the focused field
 * scrolled into view; the optional `footer` stays pinned above the keyboard. A tap outside
 * the inputs hides the keyboard.
 */
export function BottomSheet({
  visible,
  onClose,
  leading,
  returnFocusTo,
  footer,
  children,
  testID,
}: BottomSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [dragY] = useState(() => new Animated.Value(0));
  const [keyboardShown, setKeyboardShown] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);

  useEffect(() => {
    if (visible) dragY.setValue(0);
    else Keyboard.dismiss();
  }, [visible, dragY]);

  // Brings the focused field (and a little space under it) above the keyboard.
  useEffect(() => {
    if (!visible) return;
    const scrollToFocused = () => {
      const input = TextInput.State.currentlyFocusedInput();
      const content = contentRef.current;
      if (!input || !content) return;
      input.measureLayout(
        content,
        (_x, y, _w, h) => {
          const bottom = y + h + FOCUSED_FIELD_MARGIN;
          const visibleTop = scrollY.current;
          const visibleBottom = visibleTop + viewportHeight.current;
          if (y >= visibleTop && bottom <= visibleBottom) return;
          const target =
            y < visibleTop ? y - FOCUSED_FIELD_MARGIN : bottom - viewportHeight.current;
          scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: reduceMotion === false });
        },
        () => {},
      );
    };
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvent, () => setKeyboardShown(true));
    const settled = Keyboard.addListener('keyboardDidShow', () =>
      requestAnimationFrame(scrollToFocused),
    );
    const hidden = Keyboard.addListener(hideEvent, () => setKeyboardShown(false));
    return () => {
      shown.remove();
      settled.remove();
      hidden.remove();
    };
  }, [visible, reduceMotion]);

  // On close, give the screen reader's focus back to the control that opened the sheet.
  const wasVisible = useRef(visible);
  useEffect(() => {
    const closed = wasVisible.current && !visible;
    wasVisible.current = visible;
    if (!closed || !returnFocusTo) return;
    const timer = setTimeout(
      () => {
        const tag = returnFocusTo.current ? findNodeHandle(returnFocusTo.current) : null;
        if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
      },
      reduceMotion === false ? RETURN_FOCUS_DELAY.animated : RETURN_FOCUS_DELAY.still,
    );
    return () => clearTimeout(timer);
  }, [visible, returnFocusTo, reduceMotion]);

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
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
          className="gap-lg rounded-t-xl bg-surface pt-xl"
          style={{
            maxHeight: sheetMaxHeight(windowHeight, insets.top),
            // The home-indicator space is under the keyboard while it is open.
            paddingBottom: keyboardShown ? 16 : Math.max(48, insets.bottom + 16),
            boxShadow: shadows.modal,
            transform: [{ translateY: dragY }],
          }}
        >
          {/* The swipe-down handle: the content below scrolls instead. */}
          <View
            {...pan.panHandlers}
            onTouchEnd={Keyboard.dismiss}
            className="flex-row items-start justify-between px-lg"
          >
            {leading ?? <View />}
            <View className="-mr-3 -mt-2">
              <IconButton icon={X} accessibilityLabel={t('common.close')} onPress={onClose} />
            </View>
          </View>
          <ScrollView
            ref={scrollRef}
            testID={testID ? `${testID}-scroll` : 'sheet-scroll'}
            // Buttons work in one tap with the keyboard up; a tap anywhere else hides it.
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            className="shrink grow-0"
            contentContainerClassName="px-lg"
            scrollEventThrottle={16}
            onScroll={(e) => {
              scrollY.current = e.nativeEvent.contentOffset.y;
            }}
            onLayout={(e) => {
              viewportHeight.current = e.nativeEvent.layout.height;
            }}
          >
            <View ref={contentRef} className="gap-lg">
              {children}
            </View>
          </ScrollView>
          {footer ? (
            <View testID={testID ? `${testID}-footer` : 'sheet-footer'} className="px-lg">
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
