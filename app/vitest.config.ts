import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@infra': path.resolve(__dirname, 'src/infra'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@test-factories': path.resolve(__dirname, 'tests/factories'),
      '@test-mocks': path.resolve(__dirname, 'tests/mocks'),
      'react-router-dom': path.resolve(__dirname, 'src/router'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: true,
    include: [
      'features/**/*.test.{ts,tsx}',
      'infra/**/*.test.{ts,tsx}',
      'hooks/**/*.test.{ts,tsx}',
      'lib/**/*.test.{ts,tsx}',
      'ui/**/*.test.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.{ts,tsx}',
    ],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/features/**/domain/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/types.ts'],
      thresholds: {
        'src/features/**/domain/**/*.ts': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/lib/**/*.ts': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
