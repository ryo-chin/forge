import { createLocalStorageDataSource } from './localStorageDataSource.ts';
import type {
  CreateDataSourceOptions,
  TimeTrackerDataSource,
} from './types.ts';
import { createSupabaseDataSource } from './supabaseDataSource.ts';

const DATA_SOURCE_ENV_KEY = 'VITE_TIME_TRACKER_DATA_SOURCE';

const detectMode = (): 'local' | 'supabase' => {
  const explicit = import.meta.env[DATA_SOURCE_ENV_KEY];
  if (explicit === 'supabase') return 'supabase';
  if (explicit === 'local') return 'local';

  if (import.meta.env.MODE === 'test') return 'local';
  return 'supabase';
};

export const createTimeTrackerDataSource = (
  options: CreateDataSourceOptions = {},
): TimeTrackerDataSource => {
  const mode = detectMode();
  if (mode === 'supabase') {
    return createSupabaseDataSource(options);
  }
  return createLocalStorageDataSource(options);
};

export type { TimeTrackerDataSource } from './types.ts';
