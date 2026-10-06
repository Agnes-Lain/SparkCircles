import { colorValue } from './colors';

// Node built-ins, typed inline (the app itself has no Node types).
declare const __dirname: string;
/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync, readFileSync } = require('fs') as {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: 'utf8'): string;
};
const { join } = require('path') as { join(...parts: string[]): string };
const { runInNewContext } = require('vm') as {
  runInNewContext(code: string, sandbox: object): unknown;
};
/* eslint-enable @typescript-eslint/no-require-imports */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require('../../tailwind.config.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tokens = require('./tokens');

// docs/ is local-only (git-ignored, PM decision 2026-10-03): the design system file exists on the
// PM's Mac but not in CI, so the comparison with section 15 runs locally and is skipped in CI.
const designSystemPath = join(__dirname, '../../../docs/SparkCircles_Design_System_EN.md');
const hasDesignSystem = existsSync(designSystemPath);

/** Evaluates the config block of section 15 of the design system, the source of truth. */
function designSystemSection15() {
  const doc = readFileSync(designSystemPath, 'utf8');
  const section = doc.slice(doc.indexOf('## 15.'), doc.indexOf('## 16.'));
  const code = /```js\n([\s\S]*?)```/.exec(section)?.[1];
  if (!code) throw new Error('Section 15 config block not found');
  const sandbox = { module: { exports: {} as { theme: Record<string, any> } } };
  runInNewContext(code, sandbox);
  return sandbox.module.exports.theme;
}

/** Evaluates the `shellGradient` constant shown in section 15 (v1.6). */
function designSystemShellGradient() {
  const doc = readFileSync(designSystemPath, 'utf8');
  const section = doc.slice(doc.indexOf('## 15.'), doc.indexOf('## 16.'));
  const code = /```js\n(\/\/ mobile\/src\/theme\/shellGradient[\s\S]*?)```/.exec(section)?.[1];
  if (!code) throw new Error('Section 15 shellGradient block not found');
  const sandbox = { result: undefined as unknown };
  runInNewContext(code.replace('export const shellGradient =', 'result ='), sandbox);
  return sandbox.result;
}

describe('design tokens (design system section 15)', () => {
  (hasDesignSystem ? it : it.skip)('match section 15 of the design system exactly', () => {
    const theme = designSystemSection15();
    expect(tokens.colors).toEqual(theme.colors);
    expect(tokens.borderRadius).toEqual(theme.extend.borderRadius);
    expect(tokens.fontSize).toEqual(theme.extend.fontSize);
    expect(tokens.spacing).toEqual(theme.extend.spacing);
    expect(tokens.boxShadow).toEqual(theme.extend.boxShadow);
    expect(tokens.shellGradient).toEqual(designSystemShellGradient());
  });

  it('replace Tailwind default colors: only SparkCircles colors exist (M-11)', () => {
    expect(tailwindConfig.theme.colors).toBe(tokens.colors);
    expect(tailwindConfig.theme.extend.colors).toBeUndefined();
    // Tailwind default palette names, checked to be absent (not used as colors).
    /* eslint-disable no-restricted-syntax */
    ['black', 'red', 'violet', 'gray', 'blue'].forEach((name) =>
      expect(tailwindConfig.theme.colors).not.toHaveProperty(name),
    );
    /* eslint-enable no-restricted-syntax */
  });

  it('resolve token names to values', () => {
    expect(colorValue('green-dark')).toBe(tokens.colors.green.dark);
    expect(colorValue('green')).toBe(tokens.colors.green.DEFAULT);
    expect(colorValue('ink')).toBe(tokens.colors.ink.DEFAULT);
    expect(colorValue('ink-3')).toBe(tokens.colors.ink[3]);
    expect(colorValue('shell')).toBe(tokens.colors.shell);
    expect(colorValue('border-soft')).toBe(tokens.colors['border-soft']);
  });
});
