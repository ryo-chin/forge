import type {
  MetricDefinition,
  MetricDefinitionInput,
  MetricEntry,
  MetricEntryInput,
} from '../../../../features/daily-log/domain/types.ts';

export type DailyMetricsDataSource = {
  readonly mode: 'local' | 'supabase';
  listDefinitions: () => Promise<MetricDefinition[]>;
  saveDefinition: (input: MetricDefinitionInput) => Promise<MetricDefinition>;
  deleteDefinition: (id: string) => Promise<void>;
  listEntries: (fromKey: string, toKey: string) => Promise<MetricEntry[]>;
  upsertEntry: (input: MetricEntryInput) => Promise<MetricEntry>;
  deleteEntry: (metricId: string, entryDate: string) => Promise<void>;
};

export type CreateDailyMetricsDataSourceOptions = {
  userId?: string | null;
};
