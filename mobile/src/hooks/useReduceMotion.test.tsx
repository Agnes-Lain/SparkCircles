import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

describe('useReduceMotion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('follows the system reduce-motion setting and its changes', async () => {
    let listener: ((enabled: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, handler) => {
      listener = handler as unknown as (enabled: boolean) => void;
      return { remove: jest.fn() } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >;
    });

    const { result } = await renderHook(() => useReduceMotion());

    await waitFor(() => expect(result.current).toBe(true));
    await act(() => listener?.(false));
    expect(result.current).toBe(false);
  });

  it('QA BUG-05 is unknown (null) until the system answers, so nothing animates yet', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
    const { result } = await renderHook(() => useReduceMotion());
    expect(result.current).toBeNull();
  });

  it('stays still when the system cannot tell', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockRejectedValue(new Error('unavailable'));
    const { result } = await renderHook(() => useReduceMotion());
    await waitFor(() => expect(result.current).toBe(true));
  });
});
