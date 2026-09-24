import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../api/keepalive';

const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json([]));

function call(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return GET(new Request('https://example.test/api/keepalive', { headers }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('SUPABASE_URL', 'https://p.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_x');
  vi.stubEnv('CRON_SECRET', 'cron');
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('keepalive', () => {
  it('rejects a caller without the cron secret', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('makes one small read', async () => {
    const res = await call('Bearer cron');

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://p.supabase.co/rest/v1/post_views?select=slug&limit=1',
    );
  });

  it('reports a failed read as 502', async () => {
    fetchMock.mockResolvedValueOnce(new Response('paused', { status: 503 }));
    expect((await call('Bearer cron')).status).toBe(502);
  });
});
