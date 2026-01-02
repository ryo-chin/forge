import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@infra': path.resolve(__dirname, 'src/infra'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@features': path.resolve(__dirname, 'src/features'),
      'react-router-dom': path.resolve(__dirname, 'src/router'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: true,
  },
});
