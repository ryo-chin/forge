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

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const current =
        queryClient.getQueryData<MetricDefinition[]>(METRIC_DEFINITIONS_QUERY_KEY) ?? [];
      const byId = new Map(current.map((definition) => [definition.id, definition]));
      const ordered = orderedIds
        .map((id) => byId.get(id))
        .filter((definition): definition is MetricDefinition => Boolean(definition));
      await Promise.all(
        ordered.map((definition, index) =>
          dataSource.saveDefinition({ ...definition, displayOrder: index }),
        ),
      );
    },
    // 楽観更新：ドラッグ確定と同時に表示順を入れ替える（staleTime: Infinity のため再フェッチを待たない）
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: METRIC_DEFINITIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<MetricDefinition[]>(METRIC_DEFINITIONS_QUERY_KEY);
      if (previous) {
        const byId = new Map(previous.map((definition) => [definition.id, definition]));
        const reordered = orderedIds
          .map((id) => byId.get(id))
          .filter((definition): definition is MetricDefinition => Boolean(definition))
          .map((definition, index) => ({ ...definition, displayOrder: index }));
        queryClient.setQueryData(METRIC_DEFINITIONS_QUERY_KEY, reordered);
      }
      return { previous };
    },
    onError: (_error, _orderedIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(METRIC_DEFINITIONS_QUERY_KEY, context.previous);
      }
    },
    onSettled: invalidate,
  });

  const saveDefinition = useCallback(
    (input: MetricDefinitionInput) => saveMutation.mutateAsync(input),
    [saveMutation],
  );
  const deleteDefinition = useCallback(
    (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation],
  );
  const reorderDefinitions = useCallback(
    (orderedIds: string[]) => reorderMutation.mutateAsync(orderedIds),
    [reorderMutation],
  );

  const definitions: MetricDefinition[] = definitionsQuery.data ?? [];

  return {
    mode: dataSource.mode,
    definitions,
    isLoading: definitionsQuery.isLoading,
    saveDefinition,
    deleteDefinition,
    reorderDefinitions,
  };
};
