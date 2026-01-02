import { detectTimeDataSourceMode } from '@infra/config';
import { createLocalStorageDataSource } from './localStorageDataSource.ts';
import { createSupabaseDataSource } from './supabaseDataSource.ts';
import type { CreateDataSourceOptions, TimeTrackerDataSource } from './types.ts';

export const createTimeTrackerDataSource = (
  options: CreateDataSourceOptions = {},
): TimeTrackerDataSource => {
  const mode = detectTimeDataSourceMode();
  if (mode === 'supabase') {
    return createSupabaseDataSource(options);
  }
  return createLocalStorageDataSource(options);
};

export type { TimeTrackerDataSource } from './types.ts';
