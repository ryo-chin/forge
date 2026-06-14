import type { Budget, BudgetInput } from '../../../../features/reports/domain/types.ts';

export type BudgetsDataSource = {
  readonly mode: 'local' | 'supabase';
  listBudgets: () => Promise<Budget[]>;
  saveBudget: (input: BudgetInput) => Promise<Budget>;
  deleteBudget: (id: string) => Promise<void>;
};

export type CreateBudgetsDataSourceOptions = {
  userId?: string | null;
};
