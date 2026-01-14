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
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      node: true,
    },
  },
  ignorePatterns: ['dist', 'node_modules', 'tests/factories', 'tests/mocks'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

    // =====================================
    // Feature外への相対パス禁止
    // src直下のレイヤー（infra/lib/ui）への相対パス参照は禁止
    // 注: hooks/は共有もfeature内もあるため、src/hooks/への参照のみ禁止
    // =====================================
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            // src/infra/への相対パス禁止
            group: ['**/src/infra/*', '**/src/infra/**'],
            message: 'Use @infra/* alias instead of relative paths to infra layer',
          },
          {
            // src/lib/への相対パス禁止
            group: ['**/src/lib/*', '**/src/lib/**'],
            message: 'Use @lib/* alias instead of relative paths to lib layer',
          },
          {
            // src/ui/への相対パス禁止
            group: ['**/src/ui/*', '**/src/ui/**'],
            message: 'Use @ui/* alias instead of relative paths to ui layer',
          },
        ],
      },
    ],

    // =====================================
    // 循環依存検出
    // =====================================
    'import/no-cycle': ['error', { maxDepth: 3, ignoreExternal: true }],

    // =====================================
    // モジュール内部への深いアクセス制限
    // =====================================
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
          // ui層内部の依存を許可
          '**/ui/**',
          // テストユーティリティの依存を許可
          '**/tests/**',
          'react-dom/client',
          '@testing-library/jest-dom/vitest',
          'vitest/config',
        ],
      },
    ],

    // =====================================
    // Infra層の境界を強制
    // features/からinfra/impl/への直接アクセスを禁止
    // =====================================
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: './src/features/**/*',
            from: './src/infra/impl/**/*',
            message: 'Use @infra/* (infra/api/) instead of direct infra/impl/ access',
          },
          // =====================================
          // ui/components はfeatures/に依存しない
          // layouts/のみfeaturesを参照可能
          // =====================================
          {
            target: './src/ui/components/**/*',
            from: './src/features/**/*',
            message:
              'ui/components cannot depend on features. Move to ui/layouts if feature dependency is needed.',
          },
        ],
      },
    ],
  },
};
