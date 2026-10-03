// SparkCircles design tokens: design system v1.4.1, section 15
// (docs/SparkCircles_Design_System_EN.md). This is the ONLY file in mobile/ allowed to
// contain color values (ESLint enforces it). tailwind.config.js and app.config.ts read
// it, and code that needs a raw value (icon colors, native shadows) imports it.
// Don't add or change a value here without a design system change.

/** Colors replace Tailwind's defaults (theme.colors, not extend): only SparkCircles colors exist. */
const colors = {
  // Utilities kept explicitly because the defaults are gone
  transparent: 'transparent',
  current: 'currentColor', // line icons inherit the text color
  white: '#FFFFFF', // white text on Dark fills only (contrast rule 3)
  // Accents (module in comment)
  lavender: { light: '#EDE9FD', DEFAULT: '#C5B8F5', dark: '#6B5BC4' }, // Home + recommendations
  green: { light: '#E6F7DD', DEFAULT: '#A5E07F', dark: '#2F7A1F' }, // Events + primary CTA + success + verified
  sky: { light: '#E3F3FD', DEFAULT: '#8FD3F7', dark: '#1F6FA8' }, // Community
  pink: { light: '#FFEEF5', DEFAULT: '#FFB6D3', dark: '#B03A78' }, // Market
  sunny: { light: '#FFF6CC', DEFAULT: '#FFD93D', dark: '#8F5E00' }, // Travel + soft alerts
  // Status (not a module)
  error: { light: '#FDECEC', DEFAULT: '#F4A6A6', dark: '#B42318' }, // errors + destructive actions
  // Neutrals
  shell: '#F8F7F4',
  surface: '#FFFFFF',
  ink: { DEFAULT: '#1A1A1A', 2: '#4A4A4A', 3: '#6E6E6E' },
  'border-soft': 'rgba(0,0,0,0.08)',
  'border-control': '#6E6E6E',
  scrim: 'rgba(26,26,26,0.4)',
};

const borderRadius = { sm: '8px', md: '12px', lg: '16px', xl: '24px', pill: '100px' };

const fontSize = {
  data: ['32px', { lineHeight: '1.0', fontWeight: '500' }],
  h1: ['28px', { lineHeight: '1.2', fontWeight: '500' }],
  h2: ['20px', { lineHeight: '1.3', fontWeight: '500' }],
  h3: ['16px', { lineHeight: '1.4', fontWeight: '500' }],
  body: ['14px', { lineHeight: '1.6', fontWeight: '400' }],
  caption: ['12px', { lineHeight: '1.5', fontWeight: '400' }],
  label: ['11px', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.06em' }],
  'note-title': ['13px', { lineHeight: '1.4', fontWeight: '500' }],
};

const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
};

const boxShadow = {
  card: '0 1px 4px rgba(0,0,0,0.04)',
  modal: '0 4px 16px rgba(0,0,0,0.08)',
  float: '0 8px 32px rgba(0,0,0,0.12)',
};

module.exports = { colors, borderRadius, fontSize, spacing, boxShadow };
