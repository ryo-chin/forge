import { createDailyMetricsDataSource } from '@infra/repository/DailyMetrics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { MetricEntry, MetricEntryInput } from '../../domain/types.ts';

type UseMetricEntriesOptions = {
  userId?: string | null;
  fromKey: string;
  toKey: string;
};

export const metricEntriesQueryKey = (fromKey: string, toKey: string) =>
  ['daily-metrics', 'entries', fromKey, toKey] as const;

export const useMetricEntries = (options: UseMetricEntriesOptions) => {
  const { userId = null, fromKey, toKey } = options;
  const queryClient = useQueryClient();

  const dataSource = useMemo(() => createDailyMetricsDataSource({ userId }), [userId]);

  const entriesQuery = useQuery({
    queryKey: metricEntriesQueryKey(fromKey, toKey),
    queryFn: () => dataSource.listEntries(fromKey, toKey),
    enabled: dataSource.mode !== 'supabase' || Boolean(userId),
    staleTime: Infinity,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['daily-metrics', 'entries'] }),
    [queryClient],
  );

  const upsertMutation = useMutation({
    mutationFn: (input: MetricEntryInput) => dataSource.upsertEntry(input),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { metricId: string; entryDate: string }) =>
      dataSource.deleteEntry(vars.metricId, vars.entryDate),
    onSuccess: invalidate,
  });

  const upsertEntry = useCallback(
    (input: MetricEntryInput) => upsertMutation.mutateAsync(input),
    [upsertMutation],
  );
  const deleteEntry = useCallback(
    (metricId: string, entryDate: string) => deleteMutation.mutateAsync({ metricId, entryDate }),
    [deleteMutation],
  );

  const entries: MetricEntry[] = entriesQuery.data ?? [];

  return {
    mode: dataSource.mode,
    entries,
    isLoading: entriesQuery.isLoading,
    upsertEntry,
    deleteEntry,
  };
};
