import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHandler, redisStore, type ViewStore } from '../api/views';

const store = new Map<string, string>();
let storeFails = false;
let configured = true;

const getMock = vi.fn(async (slugs: string[]) => {
  if (storeFails) throw new Error('redis down');
  return slugs.map((slug) => store.get(slug) ?? null);
});

const incrementMock = vi.fn(async (slug: string) => {
  if (storeFails) throw new Error('redis down');
  const next = (Number.parseInt(store.get(slug) ?? '0', 10) || 0) + 1;
  store.set(slug, String(next));
  return next;
});

const memoryStore: ViewStore = { get: getMock, increment: incrementMock };
const handler = createHandler(() => (configured ? memoryStore : null));

function call(query: string, method: 'GET' | 'POST' = 'GET') {
  return handler(new Request(`https://example.test/api/views${query}`, { method }));
}

beforeEach(() => {
  store.clear();
  storeFails = false;
  configured = true;
  getMock.mockClear();
  incrementMock.mockClear();
});

describe('the Redis store', () => {
  it('is null without a connection', () => {
    expect(redisStore({})).toBeNull();
  });

  it('reads the Marketplace variable names and the Upstash ones', () => {
    expect(redisStore({ KV_REST_API_URL: 'https://r.test', KV_REST_API_TOKEN: 't' })).not.toBeNull();
    expect(
      redisStore({ UPSTASH_REDIS_REST_URL: 'https://r.test', UPSTASH_REDIS_REST_TOKEN: 't' }),
    ).not.toBeNull();
  });

  it('sends MGET and INCR through the pipeline endpoint', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const [command] = JSON.parse(String(init.body)) as string[][];
      const result = command![0] === 'MGET' ? ['4', null] : 5;
      return new Response(JSON.stringify([{ result }]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const redis = redisStore({ KV_REST_API_URL: 'https://r.test/', KV_REST_API_TOKEN: 't' })!;
    await expect(redis.get(['a', 'b'])).resolves.toEqual(['4', null]);
    await expect(redis.increment('a')).resolves.toBe(5);

    expect(fetchMock.mock.calls[0]![0]).toBe('https://r.test/pipeline');
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1].body))).toEqual([
      ['INCR', 'post-views:a'],
    ]);
    vi.unstubAllGlobals();
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
    expect(incrementMock).not.toHaveBeenCalled();
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

describe('when Redis is not configured', () => {
  it('answers 200 with views: null', async () => {
    configured = false;
    const res = await call('?slug=first-post');

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
