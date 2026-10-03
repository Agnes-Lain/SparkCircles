// QA (mobile-setup): accessibility and copy checks not covered by the developer's tests.
// Proposal section 7, design system P6 and sections 9, 13, 19 (voice and tone).
import { act, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { Notification } from '../../components/Notification';
import { Skeleton } from '../../components/Skeleton';
import en from '../../i18n/en.json';
import fr from '../../i18n/fr.json';
import { renderWithProviders } from '../../test/render';

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value as Record<string, unknown>).flatMap(strings);
}

describe('QA Notification (section 9)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('Error: alert role, Dark caption, title and caption read as one element', async () => {
    await renderWithProviders(
      <Notification
        level="error"
        title="Impossible de joindre SparkCircles"
        caption="Vérifie ta connexion et réessaie."
        testID="n"
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
      'Impossible de joindre SparkCirclesVérifie ta connexion et réessaie.',
    );
    expect(alert).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByText('Vérifie ta connexion et réessaie.').props.className).toContain(
      'text-error-dark',
    );
  });

  it('non-error levels are plain text with the accent tint and Dark caption', async () => {
    await renderWithProviders(
      <Notification level="reminder" title="Ton tour demain" caption="16:30" testID="n" />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('n').props.className).toContain('bg-sunny-light');
    expect(screen.getByText('16:30').props.className).toContain('text-sunny-dark');
  });

  // QA BUG-01: accessibilityLiveRegion is Android-only and React Native's `alert` role does
  // not make iOS VoiceOver speak a newly shown view. Proposal section 7 promises
  // AccessibilityInfo.announceForAccessibility for errors. `it.failing` passes while the bug
  // exists; once fixed, Jest reports it so it can become a normal `it`.
  it.failing('BUG-01 announces an Error notification when it appears (VoiceOver)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderWithProviders(
      <Notification level="error" title="Impossible de joindre SparkCircles" />,
    );
    expect(announce).toHaveBeenCalledWith(expect.stringContaining('Impossible de joindre'));
  });
});

describe('QA Skeleton and reduced motion (section 13, P6)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is hidden from screen readers', async () => {
    await renderWithProviders(<Skeleton testID="sk" />);
    expect(screen.queryByTestId('sk')).toBeNull();
    expect(screen.getByTestId('sk', { includeHiddenElements: true })).toBeTruthy();
  });

  it('pulses when motion is allowed', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const loop = jest.spyOn(Animated, 'loop');
    await renderWithProviders(<Skeleton testID="sk" />);
    await waitFor(() => expect(loop).toHaveBeenCalled());
  });

  it('stays static (opacity 1, loop stopped) under reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const stop = jest.fn();
    jest
      .spyOn(Animated, 'loop')
      .mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() } as never);
    await renderWithProviders(<Skeleton testID="sk" />);
    await act(async () => undefined);
    await waitFor(() => expect(stop).toHaveBeenCalled());
    const node = screen.getByTestId('sk', { includeHiddenElements: true });
    const opacity = node.props.style.opacity;
    expect(typeof opacity === 'number' ? opacity : opacity.__getValue()).toBe(1);
  });
});

describe('QA copy (section 19, CLAUDE.md tone)', () => {
  it('French uses "tu", never "vous"', () => {
    const offenders = strings(fr).filter((s) => /\b(vous|votre|vos)\b/i.test(s));
    expect(offenders).toEqual([]);
  });

  it('labels are sentence case in both languages', () => {
    [...strings(fr), ...strings(en)].forEach((s) => {
      const words = s.split(/\s+/).slice(1);
      // Only the brand name may be capitalised after the first word.
      words
        .filter((w) => /^[A-ZÀ-Ý]/.test(w))
        .forEach((w) => expect(w).toMatch(/^(SparkCircles|API)/));
    });
  });
});
