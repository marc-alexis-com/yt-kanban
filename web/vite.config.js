import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

// `pnpm dev` serves the frontend with hot reload and proxies the API to
// `pnpm dev:server` (port 3000).
export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/thumbs': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
