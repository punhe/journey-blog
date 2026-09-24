import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHandler, supabaseStore, type ViewStore } from '../api/views';

const store = new Map<string, string>();
let storeFails = false;
let configured = true;

const getMock = vi.fn(async (slugs: string[]) => {
  if (storeFails) throw new Error('supabase down');
  return slugs.map((slug) => store.get(slug) ?? null);
});

const incrementMock = vi.fn(async (slug: string) => {
  if (storeFails) throw new Error('supabase down');
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

describe('the Supabase store', () => {
  const env = { SUPABASE_URL: 'https://p.supabase.co/', SUPABASE_SECRET_KEY: 'sb_secret_x' };

  it('is null without a connection', () => {
    expect(supabaseStore({})).toBeNull();
    expect(supabaseStore({ SUPABASE_URL: 'https://p.supabase.co' })).toBeNull();
  });

  it('reads counts with one filtered select, in the order asked', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([{ slug: 'c', views: 7 }, { slug: 'a', views: 3 }]),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(supabaseStore(env)!.get(['a', 'b', 'c'])).resolves.toEqual([3, null, 7]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://p.supabase.co/rest/v1/post_views?select=slug,views&slug=in.(a,b,c)',
      expect.objectContaining({ method: 'GET' }),
    );
    vi.unstubAllGlobals();
  });

  it('increments through the SQL function', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json(5));
    vi.stubGlobal('fetch', fetchMock);

    await expect(supabaseStore(env)!.increment('a')).resolves.toBe(5);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://p.supabase.co/rest/v1/rpc/increment_post_view');
    expect(JSON.parse(String(init.body))).toEqual({ p_slug: 'a' });
    vi.unstubAllGlobals();
  });

  it('sends a secret key as apikey only, and a legacy JWT as Bearer too', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json([]));
    vi.stubGlobal('fetch', fetchMock);

    await supabaseStore(env)!.get(['a']);
    await supabaseStore({ SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'eyJx' })!.get([
      'a',
    ]);

    const headers = fetchMock.mock.calls.map(([, init]) => init.headers as Record<string, string>);
    expect(headers[0]).toMatchObject({ apikey: 'sb_secret_x' });
    expect(headers[0]).not.toHaveProperty('authorization');
    expect(headers[1]).toMatchObject({ apikey: 'eyJx', authorization: 'Bearer eyJx' });
    vi.unstubAllGlobals();
  });

  it('turns an error status into a thrown error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('paused', { status: 503 })));
    await expect(supabaseStore(env)!.get(['a'])).rejects.toThrow('503');
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

describe('when Supabase is not configured', () => {
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
