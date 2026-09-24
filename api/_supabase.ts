/**
 * Supabase access for the view counter and the keep-alive cron.
 *
 * Talks to PostgREST with fetch, so the functions need no client library.
 * The files in api/ whose name starts with an underscore are not deployed as
 * routes: this one is shared code only.
 *
 * The connection comes from SUPABASE_URL and a server key: the secret key
 * (SUPABASE_SECRET_KEY, `sb_secret_...`) or the older service role JWT
 * (SUPABASE_SERVICE_ROLE_KEY). The Vercel Supabase integration sets these.
 * The table has row level security on and no policies, so only a server key
 * can read or write it.
 */

export const TABLE = 'post_views';

type Env = Record<string, string | undefined>;

export interface Supabase {
  /** Calls PostgREST at `path` (relative to /rest/v1/) and returns the JSON body. */
  request(path: string, init?: { method?: string; body?: unknown }): Promise<unknown>;
}

export function supabaseFromEnv(env: Env = process.env): Supabase | null {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const base = `${url.replace(/\/$/, '')}/rest/v1/`;
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' };
  // A legacy service role key is a JWT and also goes in Authorization.
  // The newer sb_secret_ keys are not JWTs and must not.
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`;

  return {
    async request(path, init = {}) {
      const res = await fetch(base + path, {
        method: init.method ?? 'GET',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${await res.text()}`);
      return res.json();
    },
  };
}
