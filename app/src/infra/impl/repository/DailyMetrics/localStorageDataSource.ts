import type {
  MetricDefinition,
  MetricDefinitionInput,
  MetricEntry,
  MetricEntryInput,
  MetricKind,
  MetricValue,
} from '../../../../features/daily-log/domain/types.ts';
import { loadJsonList, saveJsonList } from '../../localstorage/jsonListStorage.ts';
import type { DailyMetricsDataSource } from './types.ts';

const DEFINITIONS_KEY = 'forge/daily-metric-definitions';
const ENTRIES_KEY = 'forge/daily-metric-entries';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const KINDS = new Set<MetricKind>(['boolean', 'number', 'single_select', 'multi_select']);

const parseDefinition = (value: unknown): MetricDefinition | null => {
  if (!isRecord(value)) return null;
  const { id, name, kind } = value;
  if (typeof id !== 'string' || typeof name !== 'string') return null;
  if (typeof kind !== 'string' || !KINDS.has(kind as MetricKind)) return null;
  return {
    id,
    name,
    kind: kind as MetricKind,
    unit: typeof value.unit === 'string' ? value.unit : null,
    options: Array.isArray(value.options) ? (value.options as MetricDefinition['options']) : null,
    targetNumber: typeof value.targetNumber === 'number' ? value.targetNumber : null,
    displayOrder: typeof value.displayOrder === 'number' ? value.displayOrder : 0,
    archivedAt: typeof value.archivedAt === 'string' ? value.archivedAt : null,
  };
};

const parseEntry = (value: unknown): MetricEntry | null => {
  if (!isRecord(value)) return null;
  const { id, metricId, entryDate } = value;
  if (typeof id !== 'string' || typeof metricId !== 'string' || typeof entryDate !== 'string') {
    return null;
  }
  return { id, metricId, entryDate, value: value.value as MetricValue };
};

const readDefinitions = (): MetricDefinition[] => loadJsonList(DEFINITIONS_KEY, parseDefinition);
const readEntries = (): MetricEntry[] => loadJsonList(ENTRIES_KEY, parseEntry);

const normalizeDefinition = (input: MetricDefinitionInput): MetricDefinition => ({
  id: input.id ?? crypto.randomUUID(),
  name: input.name.trim(),
  kind: input.kind,
  unit: input.unit?.trim() ? input.unit.trim() : null,
  options: input.options ?? null,
  targetNumber: input.targetNumber ?? null,
  displayOrder: input.displayOrder,
  archivedAt: input.archivedAt ?? null,
});

export const createDailyMetricsLocalStorageDataSource = (): DailyMetricsDataSource => ({
  mode: 'local',
  listDefinitions: async () =>
    readDefinitions()
      .filter((definition) => !definition.archivedAt)
      .sort((a, b) => a.displayOrder - b.displayOrder),
  saveDefinition: async (input) => {
    const definition = normalizeDefinition(input);
    const current = readDefinitions();
    const index = current.findIndex((item) => item.id === definition.id);
    const next =
      index === -1
        ? [...current, definition]
        : current.map((item, i) => (i === index ? definition : item));
    saveJsonList(DEFINITIONS_KEY, next);
    return definition;
  },
  deleteDefinition: async (id) => {
    saveJsonList(
      DEFINITIONS_KEY,
      readDefinitions().filter((item) => item.id !== id),
    );
    // 関連する記録も削除
    saveJsonList(
      ENTRIES_KEY,
      readEntries().filter((entry) => entry.metricId !== id),
    );
  },
  listEntries: async (fromKey, toKey) =>
    readEntries().filter((entry) => entry.entryDate >= fromKey && entry.entryDate <= toKey),
  upsertEntry: async (input) => {
    const current = readEntries();
    const index = current.findIndex(
      (entry) => entry.metricId === input.metricId && entry.entryDate === input.entryDate,
    );
    const entry: MetricEntry = {
      id: input.id ?? (index === -1 ? crypto.randomUUID() : current[index].id),
      metricId: input.metricId,
      entryDate: input.entryDate,
      value: input.value,
    };
    const next =
      index === -1 ? [...current, entry] : current.map((item, i) => (i === index ? entry : item));
    saveJsonList(ENTRIES_KEY, next);
    return entry;
  },
  deleteEntry: async (metricId, entryDate) => {
    saveJsonList(
      ENTRIES_KEY,
      readEntries().filter(
        (entry) => !(entry.metricId === metricId && entry.entryDate === entryDate),
      ),
    );
  },
});
