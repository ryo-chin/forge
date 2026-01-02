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
          // infra層内部の依存を許可
          '**/infra/**',
          'react-dom/client',
          '@testing-library/jest-dom/vitest',
        ],
      },
    ],
    // Infra層の境界を強制: features/からsupabase/google/への直接アクセスを禁止
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: './src/features/**/*',
            from: './src/infra/supabase/**/*',
            message: 'Use @infra/repository or @infra/auth instead of direct Supabase access',
          },
          {
            target: './src/features/**/*',
            from: './src/infra/google/**/*',
            message: 'Use @infra/repository or @infra/config instead of direct Google API access',
          },
        ],
      },
    ],
  },
};
