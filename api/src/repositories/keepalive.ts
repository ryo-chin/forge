import type { Env } from '../env';

/**
 * Supabase の Free プランは 7 日間アクティビティがないとプロジェクトを一時停止する。
 * Cron Trigger から軽いクエリを定期的に投げて、停止されないようにする。
 */
export const pingSupabase = async (env: Env, fetchImpl: typeof fetch = fetch): Promise<void> => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase REST configuration is missing');
  }
  const url = new URL('/rest/v1/time_tracker_sessions', env.SUPABASE_URL);
  url.searchParams.set('select', 'id');
  url.searchParams.set('limit', '1');

  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase keepalive failed: ${response.status} ${body}`);
  }
};
