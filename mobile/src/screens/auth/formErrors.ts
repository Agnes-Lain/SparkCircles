import { type RefObject, useCallback } from 'react';
import { AccessibilityInfo, findNodeHandle, type TextInput, type View } from 'react-native';

import type { FieldErrorKey } from '../../api/types';

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same shape as the server's check: something@something.tld (design S2 "looks incomplete"). */
export function looksLikeEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

/** Passwords need at least 10 characters (AC-1.4); the breached list is checked by the API. */
export const MIN_PASSWORD_LENGTH = 10;

/** API `details` (field → keys) restricted to the fields a form shows. */
export function serverFieldErrors<F extends string>(
  details: Record<string, FieldErrorKey[]> | undefined,
  fields: Record<string, F>,
  message: (field: F) => string,
): FieldErrors<F> {
  const errors: FieldErrors<F> = {};
  Object.entries(details ?? {}).forEach(([apiField, keys]) => {
    const field = fields[apiField];
    if (field && keys.length > 0) errors[field] = message(field);
  });
  return errors;
}

type Focusable = RefObject<TextInput | View | null>;

/**
 * Moves focus to the first field in error, in screen order, and announces its message
 * (design system section 8: "focus moves to the first field in error", aria-live polite).
 * Text fields get the keyboard focus; checkboxes get the screen reader's focus.
 */
export function useFocusFirstError<F extends string>(
  order: readonly F[],
  refs: Record<F, Focusable>,
) {
  return useCallback(
    (errors: FieldErrors<F>) => {
      const first = order.find((field) => errors[field]);
      if (!first) return;
      const node = refs[first].current;
      if (node && 'focus' in node && typeof node.focus === 'function' && 'isFocused' in node) {
        node.focus();
      } else if (node) {
        const tag = findNodeHandle(node);
        if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
      }
      AccessibilityInfo.announceForAccessibility(errors[first] ?? '');
    },
    [order, refs],
  );
}
