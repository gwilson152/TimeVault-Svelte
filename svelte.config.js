import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
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
  },
  vitePlugin: {
    experimental: {
      useVitePreprocess: true,
    },
  },
};

export default config;