import type { Env } from '../env';
import type {
  MetricDefinitionPayload,
  MetricEntryPayload,
  MetricKind,
  MetricValuePayload,
} from '../types';
import { sanitizePostgrestSearchTerm, supabaseRequest } from './supabaseRest';

const DEFINITIONS_TABLE = 'daily_metric_definitions';
const ENTRIES_TABLE = 'daily_metric_entries';
const DEFINITION_SELECT = 'id,name,kind,unit,options,target_number,display_order,archived_at';
const ENTRY_SELECT = 'id,metric_id,entry_date,value';

type DefinitionRow = {
  id: string;
  name: string;
  kind: MetricKind;
  unit: string | null;
  options: MetricDefinitionPayload['options'];
  target_number: number | null;
  display_order: number | null;
  archived_at: string | null;
};

type EntryRow = {
  id: string;
  metric_id: string;
  entry_date: string;
  value: MetricValuePayload;
};

const mapDefinition = (row: DefinitionRow): MetricDefinitionPayload => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  unit: row.unit,
  options: row.options ?? null,
  targetNumber: row.target_number,
  displayOrder: row.display_order ?? 0,
  archivedAt: row.archived_at,
});

const mapEntry = (row: EntryRow): MetricEntryPayload => ({
  id: row.id,
  metricId: row.metric_id,
  entryDate: row.entry_date,
  value: row.value,
});

export const listDefinitions = async (
  env: Env,
  userId: string,
): Promise<MetricDefinitionPayload[]> => {
  const rows = await supabaseRequest<DefinitionRow[]>(env, 'GET', DEFINITIONS_TABLE, {
    searchParams: {
      select: DEFINITION_SELECT,
      user_id: `eq.${userId}`,
      archived_at: 'is.null',
      order: 'display_order.asc',
    },
  });
  return rows.map(mapDefinition);
};

export const findDefinitionByName = async (
  env: Env,
  userId: string,
  name: string,
): Promise<MetricDefinitionPayload | null> => {
  const safe = sanitizePostgrestSearchTerm(name);
  const rows = await supabaseRequest<DefinitionRow[]>(env, 'GET', DEFINITIONS_TABLE, {
    searchParams: {
      select: DEFINITION_SELECT,
      user_id: `eq.${userId}`,
      name: `eq.${safe}`,
      archived_at: 'is.null',
      limit: '1',
    },
  });
  return rows.length > 0 ? mapDefinition(rows[0]) : null;
};

export const upsertDefinition = async (
  env: Env,
  userId: string,
  definition: MetricDefinitionPayload,
): Promise<MetricDefinitionPayload> => {
  const rows = await supabaseRequest<DefinitionRow[]>(env, 'POST', DEFINITIONS_TABLE, {
    body: {
      id: definition.id,
      user_id: userId,
      name: definition.name,
      kind: definition.kind,
      unit: definition.unit ?? null,
      options: definition.options ?? null,
      target_number: definition.targetNumber ?? null,
      display_order: definition.displayOrder,
      archived_at: definition.archivedAt ?? null,
      updated_at: new Date().toISOString(),
    },
    searchParams: { on_conflict: 'id', select: DEFINITION_SELECT },
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return mapDefinition(rows[0]);
};

export const deleteDefinition = async (env: Env, userId: string, id: string): Promise<void> => {
  await supabaseRequest(env, 'DELETE', DEFINITIONS_TABLE, {
    searchParams: { user_id: `eq.${userId}`, id: `eq.${id}` },
  });
};

export const listEntries = async (
  env: Env,
  userId: string,
  fromKey: string,
  toKey: string,
): Promise<MetricEntryPayload[]> => {
  const rows = await supabaseRequest<EntryRow[]>(env, 'GET', ENTRIES_TABLE, {
    searchParams: {
      select: ENTRY_SELECT,
      user_id: `eq.${userId}`,
      and: `(entry_date.gte.${fromKey},entry_date.lte.${toKey})`,
      order: 'entry_date.desc',
    },
  });
  return rows.map(mapEntry);
};

export const upsertEntry = async (
  env: Env,
  userId: string,
  entry: { metricId: string; entryDate: string; value: MetricValuePayload },
): Promise<MetricEntryPayload> => {
  const rows = await supabaseRequest<EntryRow[]>(env, 'POST', ENTRIES_TABLE, {
    body: {
      user_id: userId,
      metric_id: entry.metricId,
      entry_date: entry.entryDate,
      value: entry.value,
      updated_at: new Date().toISOString(),
    },
    searchParams: { on_conflict: 'user_id,metric_id,entry_date', select: ENTRY_SELECT },
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return mapEntry(rows[0]);
};

export const deleteEntry = async (
  env: Env,
  userId: string,
  metricId: string,
  entryDate: string,
): Promise<void> => {
  await supabaseRequest(env, 'DELETE', ENTRIES_TABLE, {
    searchParams: {
      user_id: `eq.${userId}`,
      metric_id: `eq.${metricId}`,
      entry_date: `eq.${entryDate}`,
    },
  });
};
