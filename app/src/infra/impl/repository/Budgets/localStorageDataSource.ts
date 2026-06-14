import type { Budget, BudgetInput } from '../../../../features/reports/domain/types.ts';
import { loadJsonList, saveJsonList } from '../../localstorage/jsonListStorage.ts';
import type { BudgetsDataSource } from './types.ts';

const STORAGE_KEY = 'forge/budgets';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseBudget = (value: unknown): Budget | null => {
  if (!isRecord(value)) return null;
  const { id, tag, weekdayMinutes, effectiveFrom } = value;
  if (typeof id !== 'string' || typeof tag !== 'string' || typeof effectiveFrom !== 'string') {
    return null;
  }
  if (!Array.isArray(weekdayMinutes) || weekdayMinutes.length !== 7) return null;
  const minutes = weekdayMinutes.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0));
  return {
    id,
    tag,
    label: typeof value.label === 'string' ? value.label : null,
    weekdayMinutes: minutes,
    effectiveFrom,
    effectiveTo: typeof value.effectiveTo === 'string' ? value.effectiveTo : null,
  };
};

const readBudgets = (): Budget[] => loadJsonList(STORAGE_KEY, parseBudget);

const normalizeBudget = (input: BudgetInput): Budget => ({
  id: input.id ?? crypto.randomUUID(),
  tag: input.tag.trim(),
  label: input.label?.trim() ? input.label.trim() : null,
  weekdayMinutes: input.weekdayMinutes,
  effectiveFrom: input.effectiveFrom,
  effectiveTo: input.effectiveTo ?? null,
});

export const createBudgetsLocalStorageDataSource = (): BudgetsDataSource => ({
  mode: 'local',
  listBudgets: async () => readBudgets(),
  saveBudget: async (input) => {
    const budget = normalizeBudget(input);
    const current = readBudgets();
    const index = current.findIndex((item) => item.id === budget.id);
    const next = index === -1 ? [...current, budget] : current.map((item, i) => (i === index ? budget : item));
    saveJsonList(STORAGE_KEY, next);
    return budget;
  },
  deleteBudget: async (id) => {
    const next = readBudgets().filter((item) => item.id !== id);
    saveJsonList(STORAGE_KEY, next);
  },
});
