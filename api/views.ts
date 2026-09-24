/**
 * Post view counter, a Vercel Function.
 *
 *   GET  /api/views?slug=a          -> { "views": { "a": 12 } }   (0 when absent)
 *   GET  /api/views?slugs=a,b,c     -> { "views": { "a": 12, ... } }  (100 slugs max)
 *   POST /api/views?slug=a          -> { "views": { "a": 13 } }
 *
 * Storage is the Supabase table `post_views` (slug, views). The increment is
 * the SQL function `increment_post_view`, one upsert, so two overlapping
 * requests never lose a count. The schema is in supabase/migrations/.
 *
 * When Supabase is not configured or cannot be reached (a paused free
 * project, for one), the response is 200 with `views: null`. The page then
 * hides the counter instead of showing a wrong 0.
 */

import { supabaseFromEnv, TABLE } from './_supabase';

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

/** The Supabase store. Returns null when the connection is not configured. */
export function supabaseStore(env?: Record<string, string | undefined>): ViewStore | null {
  const db = supabaseFromEnv(env);
  if (!db) return null;

  return {
    async get(slugs) {
      // Slugs passed SLUG_PATTERN, so they are safe inside the in.() filter.
      const rows = (await db.request(
        `${TABLE}?select=slug,views&slug=in.(${slugs.join(',')})`,
      )) as { slug: string; views: number }[];
      const bySlug = new Map(rows.map((row) => [row.slug, row.views]));
      return slugs.map((slug) => bySlug.get(slug) ?? null);
    },
    async increment(slug) {
      const count = await db.request('rpc/increment_post_view', {
        method: 'POST',
        body: { p_slug: slug },
      });
      return toCount(count as number);
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
      console.error('[views] Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.');
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
      console.error('[views] Supabase unavailable:', error);
      return json({ views: null });
    }
  };
}

const handler = createHandler(() => supabaseStore());

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const PUT = handler;
export const PATCH = handler;
