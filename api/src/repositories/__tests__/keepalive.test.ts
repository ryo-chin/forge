import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../env';
import { pingSupabase } from '../keepalive';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
} as Env;

describe('pingSupabase', () => {
  it('time_tracker_sessions を 1 件だけ取得する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    await pingSupabase(env, fetchMock as unknown as typeof fetch);

    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.pathname).toBe('/rest/v1/time_tracker_sessions');
    expect(parsed.searchParams.get('limit')).toBe('1');
    expect((init as RequestInit).headers).toMatchObject({ apikey: 'service-role' });
  });

  it('失敗したら例外を投げる（Cron の失敗としてログに残す）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('paused', { status: 540 }));
    await expect(pingSupabase(env, fetchMock as unknown as typeof fetch)).rejects.toThrow('540');
  });
});
