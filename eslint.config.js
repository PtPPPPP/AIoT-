import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'graphify-out', 'scripts', 'tests', 'playwright.config.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2020, globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly', performance: 'readonly', File: 'readonly', FileReader: 'readonly', Image: 'readonly', URL: 'readonly', Blob: 'readonly', atob: 'readonly', structuredClone: 'readonly', Storage: 'readonly' } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    languageOptions: { globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', vi: 'readonly', beforeEach: 'readonly' } },
  },
);
