import { createBudgetsDataSource } from '@infra/repository/Budgets';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { Budget, BudgetInput } from '../../domain/types.ts';

export const BUDGETS_QUERY_KEY = ['budgets'] as const;

type UseBudgetsOptions = {
  userId?: string | null;
};

export const useBudgets = (options: UseBudgetsOptions = {}) => {
  const { userId = null } = options;
  const queryClient = useQueryClient();

  const dataSource = useMemo(() => createBudgetsDataSource({ userId }), [userId]);

  const budgetsQuery = useQuery({
    queryKey: BUDGETS_QUERY_KEY,
    queryFn: dataSource.listBudgets,
    enabled: dataSource.mode !== 'supabase' || Boolean(userId),
    staleTime: Infinity,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY }),
    [queryClient],
  );

  const saveMutation = useMutation({
    mutationFn: (input: BudgetInput) => dataSource.saveBudget(input),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataSource.deleteBudget(id),
    onSuccess: invalidate,
  });

  const saveBudget = useCallback(
    (input: BudgetInput) => saveMutation.mutateAsync(input),
    [saveMutation],
  );
  const deleteBudget = useCallback((id: string) => deleteMutation.mutateAsync(id), [deleteMutation]);

  const budgets: Budget[] = budgetsQuery.data ?? [];

  return {
    mode: dataSource.mode,
    budgets,
    isLoading: budgetsQuery.isLoading,
    saveBudget,
    deleteBudget,
  };
};
