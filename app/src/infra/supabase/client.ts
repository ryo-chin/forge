import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

const REQUIRED_ENV_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

type RequiredEnvKey = (typeof REQUIRED_ENV_VARS)[number];

const readEnv = (key: RequiredEnvKey): string | null => {
  const value = import.meta.env?.[key];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return null;
};

export const getSupabaseClient = (): SupabaseClient => {
  if (client) {
    return client;
  }

  const missingKeys: RequiredEnvKey[] = [];
  const config: Record<RequiredEnvKey, string> = {} as Record<
    RequiredEnvKey,
    string
  >;

  for (const key of REQUIRED_ENV_VARS) {
    const value = readEnv(key);
    if (!value) {
      missingKeys.push(key);
    } else {
      config[key] = value;
    }
  }

  if (missingKeys.length > 0) {
    throw new Error(
      `[supabase] Missing environment variables: ${missingKeys.join(', ')}`,
    );
  }

  client = createClient(config.VITE_SUPABASE_URL, config.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storageKey: 'time-tracker-auth',
      autoRefreshToken: true,
    },
  });

  return client;
};
