import type { Env } from '../env';
import { deleteBudget, listBudgets, upsertBudget } from '../repositories/budgets';
import {
  deleteEntry,
  deleteDefinition,
  findDefinitionByName,
  listDefinitions,
  listEntries,
  upsertDefinition,
  upsertEntry,
} from '../repositories/dailyMetrics';
import type {
  BudgetPayload,
  MetricDefinitionPayload,
  MetricKind,
  MetricValuePayload,
} from '../types';

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
};

const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const requireDateKey = (value: unknown, field: string): string => {
  const str = requireString(value, field);
  if (!DATE_KEY.test(str)) {
    throw new Error(`${field} must be formatted as YYYY-MM-DD`);
  }
  return str;
};

const utcTodayKey = (): string => new Date().toISOString().slice(0, 10);

const toNumberArray7 = (value: unknown, field: string): number[] => {
  if (!Array.isArray(value) || value.length !== 7) {
    throw new Error(`${field} must be an array of 7 numbers (Sun..Sat)`);
  }
  return value.map((item) => {
    const num = typeof item === 'number' ? item : Number(item);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  });
};

// ===== 予実 =====
export const listBudgetsForUser = async (env: Env, userId: string) => ({
  budgets: await listBudgets(env, userId),
});

export const setBudgetForUser = async (env: Env, userId: string, argumentsValue: unknown) => {
  const args = asObject(argumentsValue);
  let weekdayMinutes: number[];
  if (args.weekdayMinutes !== undefined) {
    weekdayMinutes = toNumberArray7(args.weekdayMinutes, 'weekdayMinutes');
  } else if (args.weekdayHours !== undefined) {
    weekdayMinutes = toNumberArray7(args.weekdayHours, 'weekdayHours').map((hours) =>
      Math.round(hours * 60),
    );
  } else {
    throw new Error('weekdayMinutes or weekdayHours is required');
  }

  const budget: BudgetPayload = {
    id: optionalString(args.id) ?? crypto.randomUUID(),
    tag: requireString(args.tag, 'tag'),
    label: optionalString(args.label) ?? null,
    weekdayMinutes,
    effectiveFrom: requireDateKey(args.effectiveFrom, 'effectiveFrom'),
    effectiveTo: typeof args.effectiveTo === 'string' && DATE_KEY.test(args.effectiveTo)
      ? args.effectiveTo
      : null,
  };
  return { budget: await upsertBudget(env, userId, budget) };
};

export const deleteBudgetForUser = async (env: Env, userId: string, argumentsValue: unknown) => {
  const args = asObject(argumentsValue);
  const id = requireString(args.id, 'id');
  await deleteBudget(env, userId, id);
  return { deleted: id };
};

// ===== デイリー記録 =====
const KINDS = new Set<MetricKind>(['boolean', 'number', 'text', 'single_select', 'multi_select']);

const validateValueForKind = (kind: MetricKind, value: unknown): MetricValuePayload => {
  switch (kind) {
    case 'boolean':
      if (typeof value !== 'boolean') throw new Error('value must be a boolean');
      return value;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error('value must be a finite number');
      }
      return value;
    case 'text':
    case 'single_select':
      if (typeof value !== 'string') throw new Error('value must be a string');
      return value;
    case 'multi_select':
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new Error('value must be an array of strings');
      }
      return value as string[];
    default:
      throw new Error(`Unsupported metric kind: ${kind}`);
  }
};

export const listMetricDefinitionsForUser = async (env: Env, userId: string) => ({
  definitions: await listDefinitions(env, userId),
});

export const defineMetricForUser = async (env: Env, userId: string, argumentsValue: unknown) => {
  const args = asObject(argumentsValue);
  const kind = requireString(args.kind, 'kind') as MetricKind;
  if (!KINDS.has(kind)) {
    throw new Error(`kind must be one of: ${[...KINDS].join(', ')}`);
  }
  const options = Array.isArray(args.options)
    ? args.options
        .map((option) => {
          const record = asObject(option);
          const value = optionalString(record.value) ?? optionalString(record.label);
          if (!value) return null;
          return { value, label: optionalString(record.label) ?? value };
        })
        .filter((option): option is { value: string; label: string } => option !== null)
    : null;

  const definition: MetricDefinitionPayload = {
    id: optionalString(args.id) ?? crypto.randomUUID(),
    name: requireString(args.name, 'name'),
    kind,
    unit: optionalString(args.unit) ?? null,
    options: kind === 'single_select' || kind === 'multi_select' ? options : null,
    targetNumber: typeof args.targetNumber === 'number' ? args.targetNumber : null,
    displayOrder: typeof args.displayOrder === 'number' ? args.displayOrder : 0,
    archivedAt: null,
  };
  return { definition: await upsertDefinition(env, userId, definition) };
};

export const recordMetricForUser = async (env: Env, userId: string, argumentsValue: unknown) => {
  const args = asObject(argumentsValue);
  const metricId = optionalString(args.metricId);
  const metricName = optionalString(args.metricName);

  let definition: MetricDefinitionPayload | null = null;
  if (metricId) {
    definition =
      (await listDefinitions(env, userId)).find((item) => item.id === metricId) ?? null;
  } else if (metricName) {
    definition = await findDefinitionByName(env, userId, metricName);
  } else {
    throw new Error('metricId or metricName is required');
  }
  if (!definition) {
    throw new Error('metric definition not found');
  }

  const entryDate = args.entryDate === undefined ? utcTodayKey() : requireDateKey(args.entryDate, 'entryDate');
  const value = validateValueForKind(definition.kind, args.value);

  const entry = await upsertEntry(env, userId, {
    metricId: definition.id,
    entryDate,
    value,
  });
  return { entry, metric: { id: definition.id, name: definition.name, kind: definition.kind } };
};

export const listMetricEntriesForUser = async (
  env: Env,
  userId: string,
  argumentsValue: unknown,
) => {
  const args = asObject(argumentsValue);
  const from = requireDateKey(args.from, 'from');
  const to = requireDateKey(args.to, 'to');
  return { entries: await listEntries(env, userId, from, to) };
};

export const deleteMetricForUser = async (env: Env, userId: string, argumentsValue: unknown) => {
  const args = asObject(argumentsValue);
  const id = requireString(args.id, 'id');
  await deleteDefinition(env, userId, id);
  return { deleted: id };
};

export const deleteMetricEntryForUser = async (
  env: Env,
  userId: string,
  argumentsValue: unknown,
) => {
  const args = asObject(argumentsValue);
  const metricId = requireString(args.metricId, 'metricId');
  const entryDate = requireDateKey(args.entryDate, 'entryDate');
  await deleteEntry(env, userId, metricId, entryDate);
  return { deleted: { metricId, entryDate } };
};
