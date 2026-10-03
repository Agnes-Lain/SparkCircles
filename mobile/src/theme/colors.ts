// Typed access to the color tokens for code that needs a raw value (icon colors,
// ActivityIndicator). Components use Tailwind classes everywhere else.
import { boxShadow, colors } from './tokens';

type Palette = typeof colors;
type Shade<K extends string, V> = V extends string
  ? K
  : { [S in keyof V & (string | number)]: S extends 'DEFAULT' ? K : `${K}-${S}` }[keyof V &
      (string | number)];

/** Every color token name, as in the Tailwind classes: 'ink', 'ink-2', 'green-dark', 'shell'… */
export type ColorToken = { [K in keyof Palette & string]: Shade<K, Palette[K]> }[keyof Palette &
  string];

/** Returns the value of a color token, e.g. colorValue('green-dark'). */
export function colorValue(token: ColorToken): string {
  const palette = colors as unknown as Record<string, string | Record<string, string>>;
  const direct = palette[token];
  if (typeof direct === 'string') return direct;
  if (direct && typeof direct.DEFAULT === 'string') return direct.DEFAULT;
  const dash = token.lastIndexOf('-');
  const family = palette[token.slice(0, dash)];
  const value = typeof family === 'object' ? family[token.slice(dash + 1)] : undefined;
  if (!value) throw new Error(`Unknown color token: ${token}`);
  return value;
}

export const shadows = boxShadow;
