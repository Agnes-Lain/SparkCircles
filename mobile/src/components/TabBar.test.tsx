import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import i18n from '../i18n';
import { TABS } from '../navigation/tabs';
import { colorValue, shadows } from '../theme/colors';
import { renderWithProviders } from '../test/render';
import { TabBar } from './TabBar';

describe('TabBar (design system v1.7 section 10)', () => {
  beforeEach(() => i18n.changeLanguage('fr'));
  afterEach(() => jest.restoreAllMocks());

  async function renderBar(activeRoute: (typeof TABS)[number]['route'] = 'index') {
    const onTabPress = jest.fn();
    await renderWithProviders(
      <TabBar tabs={TABS} activeRoute={activeRoute} onTabPress={onTabPress} />,
    );
    return { onTabPress };
  }

  it('shows the 5 tabs in the fixed order, My space in the centre, with visible French labels', async () => {
    await renderBar();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Sorties',
      'Cercles',
      'Mon espace',
      'Services',
      'Voyages',
    ]);
    // Labels are always visible text, never icon-only.
    ['Sorties', 'Cercles', 'Mon espace', 'Services', 'Voyages'].forEach((label) =>
      expect(screen.getByText(label)).toBeVisible(),
    );
  });

  it('shows English labels when the app is in English (Market is renamed Services)', async () => {
    await i18n.changeLanguage('en');
    await renderBar();
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Events',
      'Circles',
      'My space',
      'Services',
      'Travel',
    ]);
  });

  it('is announced as a tab list', async () => {
    await renderBar();
    const bar = screen.getByTestId('tab-bar');
    expect(bar).toHaveProp('accessibilityRole', 'tablist');
    expect(bar).toHaveProp('accessibilityLabel', 'Sections principales');
  });

  it('marks only the active tab as selected', async () => {
    await renderBar('community');
    expect(screen.getByRole('tab', { name: 'Cercles' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Sorties' })).not.toBeSelected();
    expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
  });

  it('gives every tab a touch target of at least 44 px', async () => {
    await renderBar();
    screen.getAllByRole('tab').forEach((tab) => {
      expect(tab).toHaveStyle({ minHeight: 44 });
    });
  });

  it('reports the pressed tab', async () => {
    const { onTabPress } = await renderBar();
    await fireEvent.press(screen.getByRole('tab', { name: 'Voyages' }));
    expect(onTabPress).toHaveBeenCalledWith('travel');
    await fireEvent.press(screen.getByRole('tab', { name: 'Mon espace' }));
    expect(onTabPress).toHaveBeenCalledWith('my-space');
  });

  // Design system v1.4.2 section 10: tab labels ≤ about 8 characters (50 pt at 11 pt), with
  // one approved exception since v1.7: "Mon espace" in the raised centre slot.
  it('keeps every tab label to 8 characters at most, except the approved "Mon espace" (v1.7)', () => {
    for (const lng of ['fr', 'en'] as const) {
      TABS.forEach((tab) => {
        const label = i18n.getFixedT(lng)(tab.labelKey);
        if (lng === 'fr' && tab.module === 'mySpace') {
          expect(label).toBe('Mon espace');
          return;
        }
        expect(`${lng}:${label}`).toMatch(new RegExp(`^${lng}:.{1,8}$`, 'u'));
      });
    }
  });

  it('lets tab labels grow at most 1.15× with Dynamic Type, full name for VoiceOver', async () => {
    await renderBar();
    const label = screen.getByText('Cercles');
    expect(label).toHaveProp('maxFontSizeMultiplier', 1.15);
    expect(screen.getByRole('tab', { name: 'Cercles' })).toBeOnTheScreen();
  });

  describe('centre "My space" button (B2)', () => {
    it('is a raised 60 px white disc with the Ripple symbol, a hairline border and the fab shadow', async () => {
      await renderBar();
      const disc = screen.getByTestId('my-space-disc', { includeHiddenElements: true });
      expect(disc).toHaveStyle({ width: 60, height: 60, top: -36, boxShadow: shadows.fab });
      expect(disc.props.className).toContain('bg-surface');
      expect(disc.props.className).toContain('rounded-full');
      expect(disc.props.className).toContain('border border-border-soft');
      const symbol = screen.getByTestId('my-space-symbol', { includeHiddenElements: true });
      expect(symbol).toHaveProp('width', 58);
    });

    it('keeps its label on the shared line with a 20 px placeholder; never truncated', async () => {
      await renderBar();
      const placeholder = screen.getByTestId('my-space-placeholder', {
        includeHiddenElements: true,
      });
      expect(placeholder).toHaveStyle({ width: 20, height: 20 });
      const label = screen.getByText('Mon espace');
      expect(label).toHaveProp('numberOfLines', 1);
      expect(label).toHaveProp('maxFontSizeMultiplier', 1.15);
      // About 71 pt at 1.15×: the label box is wider, so it overflows instead of truncating.
      expect(label).toHaveStyle({ width: 76 });
    });

    it('unselected: no ring, Lavender Dark label', async () => {
      await renderBar('index');
      expect(screen.getByRole('tab', { name: 'Mon espace' })).not.toBeSelected();
      expect(screen.getByText('Mon espace').props.className).toContain('text-lavender-dark');
    });

    it('selected: 3 px Lavender Base ring plus the fab shadow, Ink label, no slot fill', async () => {
      await renderBar('my-space');
      const tab = screen.getByRole('tab', { name: 'Mon espace' });
      expect(tab).toBeSelected();
      expect(tab.props.className).toContain('bg-transparent');
      expect(screen.getByTestId('my-space-disc', { includeHiddenElements: true })).toHaveStyle({
        boxShadow: `0 0 0 3px ${colorValue('lavender')}, ${shadows.fab}`,
      });
      const label = screen.getByText('Mon espace');
      expect(label.props.className).toContain('text-ink');
      expect(label.props.className).not.toContain('-dark');
    });

    it('scales to 0.96 when pressed', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      await renderBar();
      await act(async () => {});
      await fireEvent(screen.getByRole('tab', { name: 'Mon espace' }), 'pressIn');
      expect(screen.getByTestId('my-space-disc', { includeHiddenElements: true })).toHaveStyle({
        transform: [{ scale: 0.96 }],
      });
    });

    it('does not scale under reduced motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await renderBar();
      await act(async () => {});
      await fireEvent(screen.getByRole('tab', { name: 'Mon espace' }), 'pressIn');
      expect(screen.getByTestId('my-space-disc', { includeHiddenElements: true })).toHaveStyle({
        transform: [{ scale: 1 }],
      });
    });
  });
});
