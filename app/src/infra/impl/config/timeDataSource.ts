const DATA_SOURCE_ENV_KEY = 'VITE_TIME_DATA_SOURCE';

const resolveRequestedMode = (): string => {
  const raw = import.meta.env[DATA_SOURCE_ENV_KEY];
  return typeof raw === 'string' ? raw.toLowerCase() : '';
};

export const detectTimeDataSourceMode = (): 'local' | 'supabase' => {
  const explicit = resolveRequestedMode();
  const isTestEnv = import.meta.env.MODE === 'test';

  if (explicit === 'supabase' && !isTestEnv) {
    return 'supabase';
  }
  return 'local';
};

export const isSupabaseDataSourceEnabled = (): boolean => detectTimeDataSourceMode() === 'supabase';
