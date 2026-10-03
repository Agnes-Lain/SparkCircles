// Tailwind / NativeWind config = design system v1.4.1, section 15. Values live in
// src/theme/tokens.js; don't put values here.
const { colors, borderRadius, fontSize, spacing, boxShadow } = require('./src/theme/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    // Colors replace Tailwind's defaults (not under `extend`): only SparkCircles colors exist.
    colors,
    extend: { borderRadius, fontSize, spacing, boxShadow },
  },
  plugins: [],
};
