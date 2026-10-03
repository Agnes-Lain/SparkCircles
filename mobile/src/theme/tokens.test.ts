import { colorValue } from './colors';

// Node built-ins, typed inline (the app itself has no Node types).
declare const __dirname: string;
/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require('fs') as { readFileSync(path: string, encoding: 'utf8'): string };
const { join } = require('path') as { join(...parts: string[]): string };
const { runInNewContext } = require('vm') as {
  runInNewContext(code: string, sandbox: object): unknown;
};
/* eslint-enable @typescript-eslint/no-require-imports */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require('../../tailwind.config.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tokens = require('./tokens');

/** Evaluates the config block of section 15 of the design system, the source of truth. */
function designSystemSection15() {
  const doc = readFileSync(
    join(__dirname, '../../../docs/SparkCircles_Design_System_EN.md'),
    'utf8',
  );
  const section = doc.slice(doc.indexOf('## 15.'), doc.indexOf('## 16.'));
  const code = /```js\n([\s\S]*?)```/.exec(section)?.[1];
  if (!code) throw new Error('Section 15 config block not found');
  const sandbox = { module: { exports: {} as { theme: Record<string, any> } } };
  runInNewContext(code, sandbox);
  return sandbox.module.exports.theme;
}

describe('design tokens (design system section 15)', () => {
  const theme = designSystemSection15();

  it('match section 15 of the design system exactly', () => {
    expect(tokens.colors).toEqual(theme.colors);
    expect(tokens.borderRadius).toEqual(theme.extend.borderRadius);
    expect(tokens.fontSize).toEqual(theme.extend.fontSize);
    expect(tokens.spacing).toEqual(theme.extend.spacing);
    expect(tokens.boxShadow).toEqual(theme.extend.boxShadow);
  });

  it('replace Tailwind default colors: only SparkCircles colors exist (M-11)', () => {
    expect(tailwindConfig.theme.colors).toBe(tokens.colors);
    expect(tailwindConfig.theme.extend.colors).toBeUndefined();
    expect(tailwindConfig.theme.colors).not.toHaveProperty('black');
    expect(tailwindConfig.theme.colors).not.toHaveProperty('red');
    expect(tailwindConfig.theme.colors).not.toHaveProperty('violet');
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
