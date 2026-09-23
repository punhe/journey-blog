import { vi } from 'vitest';

/** Stands in for the `sanity:client` module that @sanity/astro injects. */
export const fetchMock = vi.fn();

export const sanityClient = {
  fetch: (...args: unknown[]) => fetchMock(...args),
  config: () => ({
    projectId: 'testproj',
    dataset: 'production',
    apiVersion: '2026-01-01',
  }),
};
