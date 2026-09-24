import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import sanity from '@sanity/astro';
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET, PUBLIC_SITE_URL } = loadEnv(
  process.env.NODE_ENV ?? 'development',
  process.cwd(),
  '',
);

if (!PUBLIC_SANITY_PROJECT_ID) {
  throw new Error(
    'PUBLIC_SANITY_PROJECT_ID is not set. Copy .env.example to .env and fill it in, ' +
      'or set the variable in the Vercel project settings.',
  );
}

export default defineConfig({
  // Absolute URLs for canonical tags, Open Graph, the sitemap and the feed.
  // Without this the build stamps localhost into every page.
  site: PUBLIC_SITE_URL || 'https://blog.punhelabs.io.vn',
  output: 'static',
  integrations: [
    sanity({
      projectId: PUBLIC_SANITY_PROJECT_ID,
      dataset: PUBLIC_SANITY_DATASET || 'production',
      apiVersion: '2026-01-01',
      // Builds start a second after a publish. The API CDN still serves the old
      // dataset then, and the build shipped without the new post.
      useCdn: false,
      studioBasePath: '/studio',
    }),
    react(),
    sitemap({
      // The Studio is an authenticated app, not a page anyone should find.
      filter: (page) => !page.includes('/studio'),
    }),
  ],
});
