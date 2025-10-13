module.exports = {
  root: true,
  env: {
    worker: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['dist', 'node_modules', '*.cjs'],
  rules: {
    // Worker specific rules can be added here
  },
};
