import en from './en.json';
import fr from './fr.json';
import { resolveLocale } from './index';

function keys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? keys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('i18n (M-21)', () => {
  it('uses French by default and English for English phones', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('en-GB')).toBe('en');
    expect(resolveLocale('fr')).toBe('fr');
    expect(resolveLocale('de')).toBe('fr');
    expect(resolveLocale(null)).toBe('fr');
  });

  it('has the same keys in French and English', () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  it('D-3 never says "déconnecté·e" (PM decision: neutral "Ta session a pris fin")', () => {
    expect(JSON.stringify(fr)).not.toMatch(/déconnecté·e|déconnecté\(e\)/i);
  });

  it('keeps the support contact in a single key per language (Q5, replaced later)', () => {
    const withPlaceholder = (dict: object) =>
      keys(dict).filter((key) =>
        String(
          key
            .split('.')
            .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dict),
        ).includes('[SUPPORT CONTACT]'),
      );
    expect(withPlaceholder(en)).toEqual(['support.contact']);
    expect(withPlaceholder(fr)).toEqual(['support.contact']);
  });

  it('never says "please" or "successfully" (tone of voice)', () => {
    expect(JSON.stringify(en)).not.toMatch(/please|successfully/i);
    expect(JSON.stringify(fr)).not.toMatch(/s'il (te|vous) pla[iî]t|avec succès/i);
  });
});
