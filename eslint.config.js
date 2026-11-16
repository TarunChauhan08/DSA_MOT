import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '.output/',
      '.wxt/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
      'coverage/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-empty': ['error', { allowEmptyCatch: false }],
      eqeqeq: 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/unit/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Architecture boundary: domain is pure (docs/PHASE_0_PROPOSAL.md §B).
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['wxt', 'wxt/*', '#imports'],
              message: 'domain/ must not depend on WXT/browser APIs.',
            },
            { group: ['dexie', 'dexie/*'], message: 'domain/ must not depend on persistence.' },
            { group: ['react', 'react-dom', 'react/*'], message: 'domain/ must not depend on UI.' },
            {
              group: [
                '**/platform/**',
                '**/persistence/**',
                '**/ui/**',
                '**/integrations/**',
                '**/entrypoints/**',
              ],
              message: 'domain/ may only import domain/.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'chrome', message: 'domain/ must not use browser APIs.' },
        { name: 'browser', message: 'domain/ must not use browser APIs.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Inject time; do not read the clock in domain/.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Inject time; do not read the clock in domain/.',
        },
      ],
    },
  },
  {
    // The flat config itself is plain JS; type-aware rules add no value there.
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['*.config.{js,ts}', 'tests/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Playwright fixtures must destructure `{}` when they use no other fixtures.
    files: ['tests/e2e/**/*.ts'],
    rules: { 'no-empty-pattern': 'off' },
  },
);
