import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@infra': path.resolve(__dirname, 'src/infra'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@features': path.resolve(__dirname, 'src/features'),
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
  },
});
