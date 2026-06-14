import type { Budget, BudgetInput } from '../../../../features/reports/domain/types.ts';
import { getSupabaseClient } from '../../supabase/client.ts';
import type { BudgetsDataSource, CreateBudgetsDataSourceOptions } from './types.ts';

const TABLE = 'time_tracker_budgets';
const SELECT = 'id, tag, label, weekday_minutes, effective_from, effective_to';

type BudgetRow = {
  id: string;
  tag: string;
  label: string | null;
  weekday_minutes: number[] | null;
  effective_from: string;
  effective_to: string | null;
};

const mapRowToBudget = (row: BudgetRow): Budget => ({
  id: row.id,
  tag: row.tag,
  label: row.label,
  weekdayMinutes:
    Array.isArray(row.weekday_minutes) && row.weekday_minutes.length === 7
      ? row.weekday_minutes
      : [0, 0, 0, 0, 0, 0, 0],
  effectiveFrom: row.effective_from,
  effectiveTo: row.effective_to,
});

const mapBudgetToRow = (budget: Budget, userId: string) => ({
  id: budget.id,
  user_id: userId,
  tag: budget.tag,
  label: budget.label ?? null,
  weekday_minutes: budget.weekdayMinutes,
  effective_from: budget.effectiveFrom,
  effective_to: budget.effectiveTo ?? null,
  updated_at: new Date().toISOString(),
});

export const createBudgetsSupabaseDataSource = (
  options: CreateBudgetsDataSourceOptions = {},
): BudgetsDataSource => {
  const supabase = getSupabaseClient();

  const resolveUserId = async (): Promise<string | null> => {
    if (options.userId) return options.userId;
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  };

  return {
    mode: 'supabase',
    listBudgets: async () => {
      const userId = await resolveUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from(TABLE)
        .select(SELECT)
        .eq('user_id', userId)
        .order('effective_from', { ascending: false });
      if (error) {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.error('[supabase] Failed to fetch budgets', error.message);
        }
        return [];
      }
      return ((data ?? []) as BudgetRow[]).map(mapRowToBudget);
    },
    saveBudget: async (input) => {
      const userId = await resolveUserId();
      const budget: Budget = {
        id: input.id ?? crypto.randomUUID(),
        tag: input.tag.trim(),
        label: input.label?.trim() ? input.label.trim() : null,
        weekdayMinutes: input.weekdayMinutes,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
      };
      if (!userId) return budget;
      const { error } = await supabase
        .from(TABLE)
        .upsert(mapBudgetToRow(budget, userId), { onConflict: 'id' });
      if (error) throw error;
      return budget;
    },
    deleteBudget: async (id) => {
      const userId = await resolveUserId();
      if (!userId) return;
      const { error } = await supabase.from(TABLE).delete().eq('user_id', userId).eq('id', id);
      if (error) throw error;
    },
  };
};
