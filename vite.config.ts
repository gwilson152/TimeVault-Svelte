import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [tailwindcss(), sveltekit()],
    optimizeDeps: {
      exclude: ['svelte-local-storage-store']
    },
    server: {
      port: parseInt(env.PUBLIC_CLIENT_PORT || '2100'),
      host: env.PUBLIC_CLIENT_HOST || 'localhost',
      allowedHosts: true,
      strictPort: true
    }
  };
});
