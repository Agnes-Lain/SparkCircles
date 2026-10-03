// ESLint flat config: Expo's rules + Prettier compatibility + SparkCircles rules.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

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
