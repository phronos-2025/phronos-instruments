// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
  vite: {
    build: {
      rollupOptions: {
        output: {
          // Diagnostic: Log what's being built
          banner: (chunk) => {
            if (chunk.isEntry) {
              console.log(`[BUILD DIAGNOSTIC] Building entry: ${chunk.name}`);
            }
            return '';
          }
        }
      }
    }
  }
});