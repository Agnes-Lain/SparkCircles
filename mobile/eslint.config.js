// ESLint flat config: Expo's rules + Prettier compatibility + SparkCircles rules.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

// CSS named colors (QA BUG-07). The SparkCircles token names that are also CSS names
// (white, lavender, green, pink) are allowed as plain strings, because colorValue() and
// <Icon color> take token names, but never as a style color value.
const CSS_COLORS =
  'aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen';
const CSS_COLORS_NOT_TOKENS =
  'aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|whitesmoke|yellow|yellowgreen';
const ANY_NAMED = `/^(${CSS_COLORS})$/i`;
const NAMED_NOT_TOKEN = `/^(${CSS_COLORS_NOT_TOKENS})$/i`;
// Style keys and props that take a color: color, backgroundColor, tintColor, placeholderTextColor…
const COLOR_KEY = '/[cC]olor$/';

const HEX_MESSAGE =
  'No hard-coded colors (CLAUDE.md): use a Tailwind class or colorValue() from src/theme/colors.ts. Values live only in src/theme/tokens.js.';

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  { ignores: ['dist/*', '.expo/*', 'coverage/*', 'node_modules/*', 'expo-env.d.ts'] },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['src/theme/tokens.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]', message: HEX_MESSAGE },
        { selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]', message: HEX_MESSAGE },
        { selector: 'Literal[value=/\\b(rgba?|hsla?)\\(/]', message: HEX_MESSAGE },
        { selector: 'TemplateElement[value.raw=/\\b(rgba?|hsla?)\\(/]', message: HEX_MESSAGE },
        // Named colors anywhere (except token names), and any named or numeric color as a style value.
        { selector: `Literal[value=${NAMED_NOT_TOKEN}]`, message: HEX_MESSAGE },
        {
          selector: `Property[key.name=${COLOR_KEY}] > Literal[value=${ANY_NAMED}]`,
          message: HEX_MESSAGE,
        },
        {
          selector: `Property[key.value=${COLOR_KEY}] > Literal[value=${ANY_NAMED}]`,
          message: HEX_MESSAGE,
        },
        { selector: `Property[key.name=${COLOR_KEY}] > Literal[raw=/^0x/i]`, message: HEX_MESSAGE },
        {
          selector: `JSXOpeningElement[name.name!='Icon'] > JSXAttribute[name.name=${COLOR_KEY}] Literal[value=${ANY_NAMED}]`,
          message: HEX_MESSAGE,
        },
        {
          selector: `JSXAttribute[name.name=${COLOR_KEY}] Literal[raw=/^0x/i]`,
          message: HEX_MESSAGE,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@react-native-async-storage/async-storage',
              message: 'Tokens and personal data go in expo-secure-store (src/auth/tokenStore.ts).',
            },
          ],
        },
      ],
    },
  },
  {
    // The API is called only through the typed client (CLAUDE.md).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/client.ts', 'src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Call the API through src/api/ (api().request).' },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'jest.setup.ts'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
]);
