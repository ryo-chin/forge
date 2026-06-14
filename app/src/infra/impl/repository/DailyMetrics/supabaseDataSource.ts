import type {
  MetricDefinition,
  MetricEntry,
  MetricKind,
  MetricValue,
} from '../../../../features/daily-log/domain/types.ts';
import { getSupabaseClient } from '../../supabase/client.ts';
import type { CreateDailyMetricsDataSourceOptions, DailyMetricsDataSource } from './types.ts';

const DEFINITIONS_TABLE = 'daily_metric_definitions';
const ENTRIES_TABLE = 'daily_metric_entries';
const DEFINITION_SELECT =
  'id, name, kind, unit, options, target_number, display_order, archived_at';
const ENTRY_SELECT = 'id, metric_id, entry_date, value';

type DefinitionRow = {
  id: string;
  name: string;
  kind: MetricKind;
  unit: string | null;
  options: MetricDefinition['options'];
  target_number: number | null;
  display_order: number | null;
  archived_at: string | null;
};

type EntryRow = {
  id: string;
  metric_id: string;
  entry_date: string;
  value: MetricValue;
};

const mapRowToDefinition = (row: DefinitionRow): MetricDefinition => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  unit: row.unit,
  options: row.options ?? null,
  targetNumber: row.target_number,
  displayOrder: row.display_order ?? 0,
  archivedAt: row.archived_at,
});

const mapRowToEntry = (row: EntryRow): MetricEntry => ({
  id: row.id,
  metricId: row.metric_id,
  entryDate: row.entry_date,
  value: row.value,
});

export const createDailyMetricsSupabaseDataSource = (
  options: CreateDailyMetricsDataSourceOptions = {},
): DailyMetricsDataSource => {
  const supabase = getSupabaseClient();

  const resolveUserId = async (): Promise<string | null> => {
    if (options.userId) return options.userId;
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  };

  const logError = (message: string, detail: string) => {
    if (import.meta.env.MODE !== 'test') {
      // eslint-disable-next-line no-console
      console.error(message, detail);
    }
  };

  return {
    mode: 'supabase',
    listDefinitions: async () => {
      const userId = await resolveUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from(DEFINITIONS_TABLE)
        .select(DEFINITION_SELECT)
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('display_order', { ascending: true });
      if (error) {
        logError('[supabase] Failed to fetch metric definitions', error.message);
        return [];
      }
      return ((data ?? []) as DefinitionRow[]).map(mapRowToDefinition);
    },
    saveDefinition: async (input) => {
      const userId = await resolveUserId();
      const definition: MetricDefinition = {
        id: input.id ?? crypto.randomUUID(),
        name: input.name.trim(),
        kind: input.kind,
        unit: input.unit?.trim() ? input.unit.trim() : null,
        options: input.options ?? null,
        targetNumber: input.targetNumber ?? null,
        displayOrder: input.displayOrder,
        archivedAt: input.archivedAt ?? null,
      };
      if (!userId) return definition;
      const { error } = await supabase.from(DEFINITIONS_TABLE).upsert(
        {
          id: definition.id,
          user_id: userId,
          name: definition.name,
          kind: definition.kind,
          unit: definition.unit,
          options: definition.options,
          target_number: definition.targetNumber,
          display_order: definition.displayOrder,
          archived_at: definition.archivedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
      if (error) throw error;
      return definition;
    },
    deleteDefinition: async (id) => {
      const userId = await resolveUserId();
      if (!userId) return;
      const { error } = await supabase
        .from(DEFINITIONS_TABLE)
        .delete()
        .eq('user_id', userId)
        .eq('id', id);
      if (error) throw error;
    },
    listEntries: async (fromKey, toKey) => {
      const userId = await resolveUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from(ENTRIES_TABLE)
        .select(ENTRY_SELECT)
        .eq('user_id', userId)
        .gte('entry_date', fromKey)
        .lte('entry_date', toKey);
      if (error) {
        logError('[supabase] Failed to fetch metric entries', error.message);
        return [];
      }
      return ((data ?? []) as EntryRow[]).map(mapRowToEntry);
    },
    upsertEntry: async (input) => {
      const userId = await resolveUserId();
      const entry: MetricEntry = {
        id: input.id ?? crypto.randomUUID(),
        metricId: input.metricId,
        entryDate: input.entryDate,
        value: input.value,
      };
      if (!userId) return entry;
      const { data, error } = await supabase
        .from(ENTRIES_TABLE)
        .upsert(
          {
            user_id: userId,
            metric_id: entry.metricId,
            entry_date: entry.entryDate,
            value: entry.value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,metric_id,entry_date' },
        )
        .select(ENTRY_SELECT)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRowToEntry(data as EntryRow) : entry;
    },
    deleteEntry: async (metricId, entryDate) => {
      const userId = await resolveUserId();
      if (!userId) return;
      const { error } = await supabase
        .from(ENTRIES_TABLE)
        .delete()
        .eq('user_id', userId)
        .eq('metric_id', metricId)
        .eq('entry_date', entryDate);
      if (error) throw error;
    },
  };
};
