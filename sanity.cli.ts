import { defineCliConfig } from 'sanity/cli';

// The Sanity CLI does not read `.env` for these values, so load it here.
// Without this, commands like `sanity cors add` run with no project id.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: fall back to the ambient environment.
}

export default defineCliConfig({
  api: {
    projectId: process.env.PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.PUBLIC_SANITY_DATASET ?? 'production',
  },
});
