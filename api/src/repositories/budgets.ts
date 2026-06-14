import type { Env } from '../env';
import type { BudgetPayload, BudgetUpsertRequest } from '../types';
import { supabaseRequest } from './supabaseRest';

const TABLE = 'time_tracker_budgets';
const SELECT = 'id,tag,label,weekday_minutes,effective_from,effective_to';

type BudgetRow = {
  id: string;
  tag: string;
  label: string | null;
  weekday_minutes: number[] | null;
  effective_from: string;
  effective_to: string | null;
};

const mapRow = (row: BudgetRow): BudgetPayload => ({
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

export const listBudgets = async (env: Env, userId: string): Promise<BudgetPayload[]> => {
  const rows = await supabaseRequest<BudgetRow[]>(env, 'GET', TABLE, {
    searchParams: {
      select: SELECT,
      user_id: `eq.${userId}`,
      order: 'effective_from.desc',
    },
  });
  return rows.map(mapRow);
};

export const upsertBudget = async (
  env: Env,
  userId: string,
  budget: BudgetPayload,
): Promise<BudgetPayload> => {
  const rows = await supabaseRequest<BudgetRow[]>(env, 'POST', TABLE, {
    body: {
      id: budget.id,
      user_id: userId,
      tag: budget.tag,
      label: budget.label ?? null,
      weekday_minutes: budget.weekdayMinutes,
      effective_from: budget.effectiveFrom,
      effective_to: budget.effectiveTo ?? null,
      updated_at: new Date().toISOString(),
    },
    searchParams: { on_conflict: 'id', select: SELECT },
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return mapRow(rows[0]);
};

export const deleteBudget = async (env: Env, userId: string, id: string): Promise<void> => {
  await supabaseRequest(env, 'DELETE', TABLE, {
    searchParams: { user_id: `eq.${userId}`, id: `eq.${id}` },
  });
};

export type { BudgetUpsertRequest };
