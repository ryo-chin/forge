import { createLocalStorageDataSource } from './localStorageDataSource.ts';
import type {
  CreateDataSourceOptions,
  TimeTrackerDataSource,
} from './types.ts';

const warn = () => {
  if (import.meta.env.MODE !== 'test') {
    // eslint-disable-next-line no-console
    console.warn(
      '[time-tracker] Supabase data sourceは未実装のため、ローカルストレージ実装をフォールバックとして使用します。',
    );
  }
};

export const createSupabaseDataSource = (
  options: CreateDataSourceOptions = {},
): TimeTrackerDataSource => {
  warn();
  const local = createLocalStorageDataSource(options);
  return {
    ...local,
    mode: 'supabase',
  };
};
