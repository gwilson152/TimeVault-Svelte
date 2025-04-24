import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
  ],
  css: {
    // Direct processing of CSS without PostCSS
    devSourcemap: true,
  },
  build: {
    // Improved minification
    minify: 'terser',
    target: 'esnext',
    cssTarget: 'chrome80',
  },
  optimizeDeps: {
    exclude: ['svelte-local-storage-store']
  }
});