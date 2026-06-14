import { detectTimeDataSourceMode } from '@infra/config';
import { createBudgetsLocalStorageDataSource } from './localStorageDataSource.ts';
import { createBudgetsSupabaseDataSource } from './supabaseDataSource.ts';
import type { BudgetsDataSource, CreateBudgetsDataSourceOptions } from './types.ts';

export const createBudgetsDataSource = (
  options: CreateBudgetsDataSourceOptions = {},
): BudgetsDataSource => {
  const mode = detectTimeDataSourceMode();
  if (mode === 'supabase') {
    return createBudgetsSupabaseDataSource(options);
  }
  return createBudgetsLocalStorageDataSource();
};

export type { BudgetsDataSource } from './types.ts';
