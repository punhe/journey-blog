import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
let storeFails = false;

const getMock = vi.fn(async (key: string) => {
  if (storeFails) throw new Error('blobs down');
  return store.get(key) ?? null;
});

const setMock = vi.fn(async (key: string, value: string) => {
  if (storeFails) throw new Error('blobs down');
  store.set(key, value);
});

const getStoreMock = vi.fn(() => ({ get: getMock, set: setMock }));

vi.mock('@netlify/blobs', () => ({
  getStore: (...args: unknown[]) => getStoreMock(...(args as [])),
}));

const { default: handler } = await import('../netlify/functions/views');

function call(query: string, method: 'GET' | 'POST' = 'GET') {
  return handler(new Request(`https://example.test/api/views${query}`, { method }));
}

beforeEach(() => {
  store.clear();
  storeFails = false;
  getMock.mockClear();
  setMock.mockClear();
  getStoreMock.mockClear();
});

describe('the store', () => {
  it('is opened in strong consistency mode', async () => {
    // Eventually consistent reads made every increment read a stale number,
    // so the count stuck at 1 on the live deploy.
    await call('?slug=first-post');

    expect(getStoreMock).toHaveBeenCalledWith({
      name: 'post-views',
      consistency: 'strong',
    });
  });
});

describe('GET', () => {
  it('reports 0 for a slug that was never counted', async () => {
    const res = await call('?slug=first-post');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ views: { 'first-post': 0 } });
  });

  it('reports the stored count', async () => {
    store.set('first-post', '42');

    await expect((await call('?slug=first-post')).json()).resolves.toEqual({
      views: { 'first-post': 42 },
    });
  });

  it('returns a map for a batch of slugs', async () => {
    store.set('a', '3');
    store.set('c', '7');

    const body = await (await call('?slugs=a,b,c')).json();

    expect(body).toEqual({ views: { a: 3, b: 0, c: 7 } });
  });

  it('rejects a batch of more than 100 slugs', async () => {
    const slugs = Array.from({ length: 101 }, (_, i) => `post-${i}`).join(',');
    const res = await call(`?slugs=${slugs}`);

    expect(res.status).toBe(400);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('rejects a slug outside the allowed shape', async () => {
    for (const slug of ['Upper', 'has space', 'sla/sh', 'a'.repeat(121), '']) {
      const res = await call(`?slug=${encodeURIComponent(slug)}`);
      expect(res.status, slug).toBe(400);
    }

    expect(getMock).not.toHaveBeenCalled();
  });

  it('rejects a missing slug parameter', async () => {
    expect((await call('')).status).toBe(400);
  });

  it('refuses a comma list on the single-slug parameter', async () => {
    expect((await call('?slug=a,b')).status).toBe(400);
  });
});

describe('POST', () => {
  it('increments from absent to 1', async () => {
    const body = await (await call('?slug=first-post', 'POST')).json();

    expect(body).toEqual({ views: { 'first-post': 1 } });
    expect(store.get('first-post')).toBe('1');
  });

  it('increments an existing count', async () => {
    store.set('first-post', '9');

    const body = await (await call('?slug=first-post', 'POST')).json();

    expect(body).toEqual({ views: { 'first-post': 10 } });
    expect(store.get('first-post')).toBe('10');
  });

  it('treats a corrupt stored value as 0', async () => {
    store.set('first-post', 'not-a-number');

    await expect((await call('?slug=first-post', 'POST')).json()).resolves.toEqual({
      views: { 'first-post': 1 },
    });
  });

  it('rejects an invalid slug before writing', async () => {
    expect((await call('?slug=Bad Slug', 'POST')).status).toBe(400);
    expect(setMock).not.toHaveBeenCalled();
  });
});

describe('when the store is unavailable', () => {
  it('answers 200 with views: null on read', async () => {
    storeFails = true;
    const res = await call('?slug=first-post');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ views: null });
  });

  it('answers 200 with views: null on increment', async () => {
    storeFails = true;
    const res = await call('?slug=first-post', 'POST');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ views: null });
  });
});

describe('other methods', () => {
  it('answers 405', async () => {
    const res = await handler(
      new Request('https://example.test/api/views?slug=a', { method: 'DELETE' }),
    );

    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, POST');
  });
});
