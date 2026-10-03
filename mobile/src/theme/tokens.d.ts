type Shade = { light: string; DEFAULT: string; dark: string };
type FontSize = [string, { lineHeight: string; fontWeight: string; letterSpacing?: string }];

export declare const colors: {
  transparent: string;
  current: string;
  white: string;
  lavender: Shade;
  green: Shade;
  sky: Shade;
  pink: Shade;
  sunny: Shade;
  error: Shade;
  shell: string;
  surface: string;
  ink: { DEFAULT: string; 2: string; 3: string };
  'border-soft': string;
  'border-control': string;
  scrim: string;
};
export declare const borderRadius: Record<'sm' | 'md' | 'lg' | 'xl' | 'pill', string>;
export declare const fontSize: Record<
  'data' | 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label',
  FontSize
>;
export declare const spacing: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl', string>;
export declare const boxShadow: Record<'card' | 'modal' | 'float', string>;
