// SparkCircles design tokens: design system v1.7, section 15
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
  lavender: { light: '#EDE9FD', DEFAULT: '#C5B8F5', dark: '#6B5BC4' }, // My space + recommendations
  // Mint family (v1.6); the key stays `green` so no class changes.
  green: { light: '#E4F8EE', DEFAULT: '#7BE0AD', dark: '#1B7049' }, // Events + primary CTA + success + verified
  sky: { light: '#E3F3FD', DEFAULT: '#8FD3F7', dark: '#1F6FA8' }, // Community
  pink: { light: '#FFEEF5', DEFAULT: '#FFB6D3', dark: '#B03A78' }, // Market (Services)
  sunny: { light: '#FFF6CC', DEFAULT: '#FFD93D', dark: '#8F5E00' }, // Travel + soft alerts
  // Status (not a module)
  error: { light: '#FDECEC', DEFAULT: '#F4A6A6', dark: '#B42318' }, // errors + destructive actions
  // Neutrals
  shell: '#F8F7F4', // flat fallback, camera screens (the app background is shellGradient)
  surface: '#FFFFFF',
  ink: { DEFAULT: '#1A1A1A', 2: '#4A4A4A', 3: '#6E6E6E' },
  'border-soft': 'rgba(0,0,0,0.08)',
  'border-control': '#6E6E6E',
  'other-light': '#F0F0F0', // circle behind the 'Other' category icon (icon = ink-2)
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
  fab: '0 4px 14px rgba(26,26,26,0.16)', // raised centre tab (My space)
  'icon-btn': '0 2px 8px rgba(26,26,26,0.10)', // v1.8 header icon button (back, more options)
};

/**
 * shell-gradient (v1.6): the mobile app background, drawn once by ScreenBackground.
 * Vertical: x1=0 y1=0 x2=0 y2=1.
 */
const shellGradient = {
  stops: [
    { offset: '0%', color: '#F1F9FE' }, // sky-light 50% + white (top)
    { offset: '100%', color: '#FFF6FA' }, // pink-light 50% + white (bottom)
  ],
};

module.exports = { colors, borderRadius, fontSize, spacing, boxShadow, shellGradient };
