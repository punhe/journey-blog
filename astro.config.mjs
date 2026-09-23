import react from '@astrojs/react';
import sanity from '@sanity/astro';
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } = loadEnv(
  process.env.NODE_ENV ?? 'development',
  process.cwd(),
  '',
);

if (!PUBLIC_SANITY_PROJECT_ID) {
  throw new Error(
    'PUBLIC_SANITY_PROJECT_ID is not set. Copy .env.example to .env and fill it in, ' +
      'or set the variable in the Netlify site settings.',
  );
}

export default defineConfig({
  output: 'static',
  integrations: [
    sanity({
      projectId: PUBLIC_SANITY_PROJECT_ID,
      dataset: PUBLIC_SANITY_DATASET || 'production',
      apiVersion: '2026-01-01',
      useCdn: true,
      studioBasePath: '/studio',
    }),
    react(),
  ],
});
