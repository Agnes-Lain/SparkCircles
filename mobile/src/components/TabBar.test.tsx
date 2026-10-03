import { fireEvent, screen } from '@testing-library/react-native';

import i18n from '../i18n';
import { TABS } from '../navigation/tabs';
import { renderWithProviders } from '../test/render';
import { TabBar } from './TabBar';

describe('TabBar (design system section 10)', () => {
  beforeEach(() => i18n.changeLanguage('fr'));

  async function renderBar(activeRoute: (typeof TABS)[number]['route'] = 'index') {
    const onTabPress = jest.fn();
    await renderWithProviders(
      <TabBar tabs={TABS} activeRoute={activeRoute} onTabPress={onTabPress} />,
    );
    return { onTabPress };
  }

  it('shows the 5 tabs in the fixed order, with visible French labels', async () => {
    await renderBar();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Accueil',
      'Sorties',
      'Cercles',
      'Services',
      'Voyages',
    ]);
    // Labels are always visible text, never icon-only.
    ['Accueil', 'Sorties', 'Cercles', 'Services', 'Voyages'].forEach((label) =>
      expect(screen.getByText(label)).toBeVisible(),
    );
  });

  it('shows English labels when the app is in English', async () => {
    await i18n.changeLanguage('en');
    await renderBar();
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Home',
      'Events',
      'Circles',
      'Market',
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
    expect(screen.getByRole('tab', { name: 'Accueil' })).not.toBeSelected();
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
  });

  // Design system v1.4.2 section 10: tab labels ≤ about 8 characters (50 pt at 11 pt).
  it('keeps every tab label to 8 characters at most, in French and English (v1.4.2)', () => {
    for (const lng of ['fr', 'en'] as const) {
      TABS.forEach((tab) => {
        const label = i18n.getFixedT(lng)(tab.labelKey);
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
});
