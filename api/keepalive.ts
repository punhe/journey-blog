/**
 * Keep-alive for the Supabase free project, run daily by Vercel Cron
 * (see `crons` in vercel.json).
 *
 * Supabase pauses a free project after about seven days without database
 * activity. A quiet week on the blog would pause it and hide every view
 * counter until someone restores it by hand. One small read a day counts as
 * activity.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set,
 * so the endpoint answers 401 to anyone else.
 */

import { supabaseFromEnv, TABLE } from './_supabase.js';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = supabaseFromEnv();
  if (!db) return Response.json({ ok: false, error: 'Supabase is not configured.' }, { status: 500 });

  try {
    await db.request(`${TABLE}?select=slug&limit=1`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[keepalive] Supabase unavailable:', error);
    return Response.json({ ok: false }, { status: 502 });
  }
}
