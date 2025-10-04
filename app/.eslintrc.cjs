module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'react-refresh', 'import'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'import/no-internal-modules': [
      'error',
      {
        allow: [
          '**/features/**/components/**/index.ts',
          '**/features/**/hooks/**',
          '**/features/**/domain/**',
          '**/features/**/pages/**',
          '**/hooks/**',
          '**/lib/**',
          'react-dom/client',
          '@testing-library/jest-dom/vitest',
        ],
      },
    ],
  },
};
