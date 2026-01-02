module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ['plugin:react-hooks/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.worker.json'],
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
