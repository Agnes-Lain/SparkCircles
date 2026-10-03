// QA (mobile-setup): design-system checks not covered by the developer's tests.
// Design system v1.4.1: section 2 (weights), 5 (buttons), 9 (notifications), 10 (tab bar), 15 (tokens).
import { screen } from '@testing-library/react-native';
import { House, Trash2 } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TabBar } from '../../components/TabBar';
import i18n from '../../i18n';
import { MODULE_ACCENT, TABS } from '../../navigation/tabs';
import { renderWithProviders } from '../../test/render';
import { colors } from '../../theme/tokens';

/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync, readdirSync, statSync } = require('fs') as {
  readFileSync(path: string, encoding: 'utf8'): string;
  readdirSync(path: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};
const { join } = require('path') as { join(...parts: string[]): string };
/* eslint-enable @typescript-eslint/no-require-imports */
declare const __dirname: string;

const SRC = join(__dirname, '../..');

/** Comments may cite the design system values (ESLint ignores them too). */
const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx|js)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('QA tab bar colours and states (section 10)', () => {
  beforeEach(() => i18n.changeLanguage('fr'));

  it('maps each module to its accent: Home lavender, Events green, Community sky, Market pink, Travel yellow', () => {
    expect(TABS.map((t) => [t.module, MODULE_ACCENT[t.module].activeBg])).toEqual([
      ['home', 'bg-lavender'],
      ['events', 'bg-green'],
      ['community', 'bg-sky'],
      ['market', 'bg-pink'],
      ['travel', 'bg-sunny'],
    ]);
    TABS.forEach((t) => {
      const family = MODULE_ACCENT[t.module].activeBg.replace('bg-', '');
      expect(MODULE_ACCENT[t.module].inactiveText).toBe(`text-${family}-dark`);
      expect(MODULE_ACCENT[t.module].inactiveIcon).toBe(`${family}-dark`);
    });
  });

  it.each(TABS.map((t) => t.route))(
    'active tab %s uses module Base fill + Ink label; the others use their Dark variant',
    async (activeRoute) => {
      await renderWithProviders(
        <TabBar tabs={TABS} activeRoute={activeRoute} onTabPress={() => {}} />,
      );
      TABS.forEach((tab) => {
        const accent = MODULE_ACCENT[tab.module];
        const pressable = screen.getByTestId(`tab-${tab.route}`);
        const label = screen.getByText(i18n.t(tab.labelKey));
        if (tab.route === activeRoute) {
          expect(pressable.props.className).toContain(accent.activeBg);
          expect(pressable.props.className).toContain('rounded-md'); // radius 12
          expect(label.props.className).toContain('text-ink');
          expect(label.props.className).not.toContain('-dark');
        } else {
          expect(pressable.props.className).toContain('bg-transparent');
          expect(label.props.className).toContain(accent.inactiveText);
        }
      });
    },
  );

  it('uses the approved icons (home, sparkles, users, shopping-bag, key)', () => {
    expect(TABS.map((t) => t.icon.displayName ?? '')).toEqual([
      expect.stringMatching(/House|Home/),
      expect.stringMatching(/Sparkles/),
      expect.stringMatching(/Users/),
      expect.stringMatching(/ShoppingBag/),
      expect.stringMatching(/Key/),
    ]);
  });
});

describe('QA Icon wrapper (M-13)', () => {
  it('draws Lucide icons with stroke 1.8, a token colour, hidden from screen readers', async () => {
    await renderWithProviders(<Icon icon={House} color="green-dark" testID="qa-icon" />);
    const svg = screen.getByTestId('qa-icon', { includeHiddenElements: true });
    expect(svg.props.strokeWidth ?? svg.props.stroke_width).toBe(1.8);
    expect([svg.props.color, svg.props.stroke]).toContain(colors.green.dark);
    expect(screen.queryByTestId('qa-icon')).toBeNull(); // not exposed to accessibility
  });
});

describe('QA Button variants (section 5)', () => {
  it('Destructive is error-dark with white text and its leading icon', async () => {
    await renderWithProviders(
      <Button label="Fermer mon compte" variant="destructive" icon={Trash2} onPress={() => {}} />,
    );
    const button = screen.getByRole('button', { name: 'Fermer mon compte' });
    expect(button.props.className).toContain('bg-error-dark');
    expect(screen.getByText('Fermer mon compte').props.className).toContain('text-white');
  });

  it('Disabled Primary is Shell fill, dashed Ink 3 border, Ink 3 text (not opacity 0.4)', async () => {
    await renderWithProviders(<Button label="Envoyer" disabled onPress={() => {}} />);
    const button = screen.getByRole('button', { name: 'Envoyer' });
    expect(button.props.className).toContain('bg-shell');
    expect(button.props.className).toContain('border-dashed');
    expect(button.props.className).toContain('border-ink-3');
    expect(button.props.className).not.toContain('opacity-40');
    expect(screen.getByText('Envoyer').props.className).toContain('text-ink-3');
  });

  it('every size keeps the 44 px minimum height', async () => {
    for (const size of ['large', 'default', 'small'] as const) {
      const { unmount } = await renderWithProviders(
        <Button label={`b-${size}`} size={size} onPress={() => {}} />,
      );
      expect(screen.getByRole('button', { name: `b-${size}` })).toHaveStyle({ minHeight: 44 });
      await unmount();
    }
  });
});

describe('QA source-wide rules', () => {
  const files = sourceFiles(SRC);

  it('uses weights 400 and 500 only (section 2)', () => {
    const offenders = files.filter((f) =>
      /font-(thin|extralight|light|semibold|bold|extrabold|black)\b|fontWeight:\s*['"]?[6-9]00/.test(
        readFileSync(f, 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('has no hex or rgb/rgba colour outside src/theme/tokens.js', () => {
    const offenders = files.filter(
      (f) =>
        !f.endsWith(join('theme', 'tokens.js')) &&
        /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(withoutComments(readFileSync(f, 'utf8'))),
    );
    expect(offenders).toEqual([]);
  });

  it('never imports AsyncStorage', () => {
    const offenders = files.filter((f) => /async-storage/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
