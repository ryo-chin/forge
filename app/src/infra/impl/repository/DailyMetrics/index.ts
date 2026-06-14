import { detectTimeDataSourceMode } from '@infra/config';
import { createDailyMetricsLocalStorageDataSource } from './localStorageDataSource.ts';
import { createDailyMetricsSupabaseDataSource } from './supabaseDataSource.ts';
import type { CreateDailyMetricsDataSourceOptions, DailyMetricsDataSource } from './types.ts';

export const createDailyMetricsDataSource = (
  options: CreateDailyMetricsDataSourceOptions = {},
): DailyMetricsDataSource => {
  const mode = detectTimeDataSourceMode();
  if (mode === 'supabase') {
    return createDailyMetricsSupabaseDataSource(options);
  }
  return createDailyMetricsLocalStorageDataSource();
};

export type { DailyMetricsDataSource } from './types.ts';
