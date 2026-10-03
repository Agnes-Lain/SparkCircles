import { act, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { renderWithProviders } from '../test/render';
import { Skeleton } from './Skeleton';

function mockLoop() {
  const start = jest.fn();
  const stop = jest.fn();
  const loop = jest
    .spyOn(Animated, 'loop')
    .mockReturnValue({ start, stop, reset: jest.fn() } as never);
  return { loop, start, stop };
}

function opacityOf(testID: string) {
  const { opacity } = screen.getByTestId(testID, { includeHiddenElements: true }).props.style;
  return typeof opacity === 'number' ? opacity : opacity.__getValue();
}

describe('Skeleton (design system section 13)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is hidden from screen readers', async () => {
    await renderWithProviders(<Skeleton testID="sk" />);
    expect(screen.queryByTestId('sk')).toBeNull();
  });

  it('pulses once the system allows motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { start } = mockLoop();
    await renderWithProviders(<Skeleton testID="sk" />);
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  });

  it('never moves under reduced motion: static at full opacity', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { loop } = mockLoop();
    await renderWithProviders(<Skeleton testID="sk" />);
    await act(async () => undefined);

    expect(loop).not.toHaveBeenCalled();
    expect(opacityOf('sk')).toBe(1);
  });

  it('QA BUG-05 stays static until the reduce-motion setting is known', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
    const { loop } = mockLoop();
    await renderWithProviders(<Skeleton testID="sk" />);

    expect(loop).not.toHaveBeenCalled();
    expect(opacityOf('sk')).toBe(1);
  });

  it('stops pulsing when reduce motion is turned on', async () => {
    let listener: ((enabled: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, handler) => {
      listener = handler as unknown as (enabled: boolean) => void;
      return { remove: jest.fn() } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >;
    });
    const { start, stop } = mockLoop();
    await renderWithProviders(<Skeleton testID="sk" />);
    await waitFor(() => expect(start).toHaveBeenCalled());

    await act(() => listener?.(true));

    expect(stop).toHaveBeenCalled();
    expect(opacityOf('sk')).toBe(1);
  });
});
