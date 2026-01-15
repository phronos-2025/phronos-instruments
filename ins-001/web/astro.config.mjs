// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://instruments.phronos.org',
  output: 'server',
  adapter: vercel({}),
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],
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