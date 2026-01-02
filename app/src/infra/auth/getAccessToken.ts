import { getSupabaseClient } from '../supabase/client.ts';

/**
 * 現在のセッションからアクセストークンを取得する
 * @throws Error セッションが存在しない場合
 */
export const getAccessToken = async (): Promise<string> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken = data?.session?.access_token;
  if (!accessToken) {
    throw new Error('Access token is not available');
  }

  return accessToken;
};
