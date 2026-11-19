import { defineConfig } from 'vite';

// Project site: https://jcardenas0917.github.io/amazon-catalog/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/amazon-catalog/' : '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
}));
