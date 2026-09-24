/**
 * Post view counter, a Vercel Function.
 *
 *   GET  /api/views?slug=a          -> { "views": { "a": 12 } }   (0 when absent)
 *   GET  /api/views?slugs=a,b,c     -> { "views": { "a": 12, ... } }  (100 slugs max)
 *   POST /api/views?slug=a          -> { "views": { "a": 13 } }
 *
 * Storage is Upstash Redis through its REST API: key = `post-views:<slug>`,
 * value = the count. The increment is Redis INCR, which is atomic, so two
 * overlapping requests never lose a count.
 *
 * The connection comes from KV_REST_API_URL and KV_REST_API_TOKEN (the names
 * the Vercel Marketplace integration sets), or UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN. When they are missing or the store cannot be
 * reached, the response is 200 with `views: null`. The page then hides the
 * counter instead of showing a wrong 0.
 */

const KEY_PREFIX = 'post-views:';
const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;
const MAX_SLUGS = 100;

export interface ViewStore {
  /** Counts for each slug, in order. A slug never counted reads as null. */
  get(slugs: string[]): Promise<(string | number | null)[]>;
  /** Adds one and returns the new count. */
  increment(slug: string): Promise<number>;
}

type ViewsBody = { views: Record<string, number> | null };
type ErrorBody = { error: string };

function json(body: ViewsBody | ErrorBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

/** Splits the `slugs` parameter and rejects anything outside the slug shape. */
function parseSlugs(raw: string | null, param: string): string[] | Response {
  if (raw === null) return badRequest(`Missing "${param}" parameter.`);

  const slugs = raw
    .split(',')
    .map((slug) => slug.trim())
    .filter((slug) => slug.length > 0);

  if (slugs.length === 0) return badRequest(`"${param}" is empty.`);
  if (slugs.length > MAX_SLUGS) return badRequest(`At most ${MAX_SLUGS} slugs per request.`);

  const invalid = slugs.find((slug) => !SLUG_PATTERN.test(slug));
  if (invalid !== undefined) return badRequest(`Invalid slug: "${invalid}".`);

  return slugs;
}

function toCount(value: string | number | null | undefined): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Upstash Redis over REST. Returns null when the connection is not configured. */
export function redisStore(env: Record<string, string | undefined> = process.env): ViewStore | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const endpoint = `${url.replace(/\/$/, '')}/pipeline`;

  async function pipeline(commands: string[][]): Promise<unknown[]> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`Redis answered ${res.status}`);

    const replies = (await res.json()) as { result?: unknown; error?: string }[];
    return replies.map((reply) => {
      if (reply.error) throw new Error(reply.error);
      return reply.result;
    });
  }

  return {
    async get(slugs) {
      const [values] = await pipeline([['MGET', ...slugs.map((slug) => KEY_PREFIX + slug)]]);
      return values as (string | null)[];
    },
    async increment(slug) {
      const [value] = await pipeline([['INCR', KEY_PREFIX + slug]]);
      return toCount(value as number);
    },
  };
}

export function createHandler(getStore: () => ViewStore | null) {
  return async function handler(request: Request): Promise<Response> {
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'POST') {
      return new Response(null, { status: 405, headers: { allow: 'GET, POST' } });
    }

    const params = new URL(request.url).searchParams;
    const batched = method === 'GET' && params.has('slugs');
    const parsed = batched
      ? parseSlugs(params.get('slugs'), 'slugs')
      : parseSlugs(params.get('slug'), 'slug');

    if (parsed instanceof Response) return parsed;
    if (!batched && parsed.length > 1) {
      return badRequest('Use the "slugs" parameter to read more than one post.');
    }

    const store = getStore();
    if (!store) {
      console.error('[views] Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.');
      return json({ views: null });
    }

    try {
      const views: Record<string, number> = {};

      if (method === 'POST') {
        const slug = parsed[0]!;
        views[slug] = await store.increment(slug);
        return json({ views });
      }

      const values = await store.get(parsed);
      parsed.forEach((slug, i) => {
        views[slug] = toCount(values[i]);
      });

      return json({ views });
    } catch (error) {
      console.error('[views] Redis unavailable:', error);
      return json({ views: null });
    }
  };
}

const handler = createHandler(() => redisStore());

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const PUT = handler;
export const PATCH = handler;
