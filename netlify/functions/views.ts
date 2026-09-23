/**
 * Post view counter.
 *
 *   GET  /api/views?slug=a          -> { "views": { "a": 12 } }   (0 when absent)
 *   GET  /api/views?slugs=a,b,c     -> { "views": { "a": 12, ... } }  (100 slugs max)
 *   POST /api/views?slug=a          -> { "views": { "a": 13 } }
 *
 * Storage is Netlify Blobs: store `post-views`, key = slug, value = the count
 * as a decimal string.
 *
 * The increment reads and then writes. Netlify Blobs has no compare-and-set,
 * so two requests that overlap can both read the same number and one increment
 * is lost. A personal blog does not need exact counts, and the alternative
 * (an external database) is not worth the cost here.
 *
 * When the store cannot be reached the response is 200 with `views: null`.
 * The page then hides the counter instead of showing a wrong 0.
 */

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'post-views';
const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;
const MAX_SLUGS = 100;

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

function toCount(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default async function handler(request: Request): Promise<Response> {
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

  try {
    const store = getStore(STORE_NAME);
    const views: Record<string, number> = {};

    if (method === 'POST') {
      const slug = parsed[0]!;
      const next = toCount(await store.get(slug, { type: 'text' })) + 1;
      await store.set(slug, String(next));
      views[slug] = next;
      return json({ views });
    }

    await Promise.all(
      parsed.map(async (slug) => {
        views[slug] = toCount(await store.get(slug, { type: 'text' }));
      }),
    );

    return json({ views });
  } catch (error) {
    console.error('[views] Blobs unavailable:', error);
    return json({ views: null });
  }
}
