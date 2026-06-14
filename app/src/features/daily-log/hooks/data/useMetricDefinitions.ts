import { createDailyMetricsDataSource } from '@infra/repository/DailyMetrics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { MetricDefinition, MetricDefinitionInput } from '../../domain/types.ts';

export const METRIC_DEFINITIONS_QUERY_KEY = ['daily-metrics', 'definitions'] as const;

type UseMetricDefinitionsOptions = {
  userId?: string | null;
};

export const useMetricDefinitions = (options: UseMetricDefinitionsOptions = {}) => {
  const { userId = null } = options;
  const queryClient = useQueryClient();

  const dataSource = useMemo(() => createDailyMetricsDataSource({ userId }), [userId]);

  const definitionsQuery = useQuery({
    queryKey: METRIC_DEFINITIONS_QUERY_KEY,
    queryFn: dataSource.listDefinitions,
    enabled: dataSource.mode !== 'supabase' || Boolean(userId),
    staleTime: Infinity,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: METRIC_DEFINITIONS_QUERY_KEY }),
    [queryClient],
  );

  const saveMutation = useMutation({
    mutationFn: (input: MetricDefinitionInput) => dataSource.saveDefinition(input),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataSource.deleteDefinition(id),
    onSuccess: invalidate,
  });

  const saveDefinition = useCallback(
    (input: MetricDefinitionInput) => saveMutation.mutateAsync(input),
    [saveMutation],
  );
  const deleteDefinition = useCallback(
    (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation],
  );

  const definitions: MetricDefinition[] = definitionsQuery.data ?? [];

  return {
    mode: dataSource.mode,
    definitions,
    isLoading: definitionsQuery.isLoading,
    saveDefinition,
    deleteDefinition,
  };
};
