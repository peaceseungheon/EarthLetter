// @ts-check
// eslint.config.mjs — Nuxt 3 flat config.
// @nuxt/eslint generates the base ruleset via `nuxt prepare`; this file
// extends it with project-wide overrides.

import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Nuxt convention: no semicolons, single quotes, 2-space indent.
    semi: ['error', 'never'],
    quotes: ['error', 'single', { avoidEscape: true }],
    indent: ['error', 2, { SwitchCase: 1 }],
    'comma-dangle': ['error', 'never'],

    // Vue SFC style aligned with Prettier.
    'vue/html-indent': ['error', 2],
    'vue/multi-word-component-names': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/singleline-html-element-content-newline': 'off',

    // TypeScript: allow `any` only with explicit narrowing in server code.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports' }
    ]
  },
  ignores: [
    '.nuxt/**',
    '.output/**',
    'dist/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'node_modules/**',
    'assets/geo/*.json'
  ]
})
