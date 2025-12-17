import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Soften strictness to unblock incremental adoption
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'warn',
        { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-control-regex': 'warn',
      'prefer-const': 'warn',
      'react-refresh/only-export-components': 'warn',

      // Warn-only module boundary rules (see src/pages/AGENT.md)
      'import/no-restricted-paths': [
        'warn',
        {
          zones: [
            // pages → features: only public surface allowed
            {
              target: './src/pages',
              from: './src/features',
              except: ['**/public', '**/public.ts'],
              message: 'Pages may import only features/*/public.',
            },
            // pages must not import api directly
            {
              target: './src/pages',
              from: './src/api',
              message: 'Pages must not import api directly; use feature hooks/services.',
            },
            // components must not import from pages
            {
              target: './src/components',
              from: './src/pages',
              message: 'Components must not import from pages.',
            },
          ],
        },
      ],
    },
  },
])
