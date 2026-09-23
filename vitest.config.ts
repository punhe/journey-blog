import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // `sanity:client` is injected by @sanity/astro at build time. Tests get a stub.
      'sanity:client': fileURLToPath(new URL('./tests/mocks/sanity-client.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
