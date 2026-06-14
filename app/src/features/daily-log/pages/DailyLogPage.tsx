import { useAuth } from '@infra/auth';
import { addDays, eachDayKey, toDateKey } from '@lib/date.ts';
import { LineChart } from '@ui/components/LineChart';
import { useMemo, useState } from 'react';
import '../daily-log.css';
import { DailyMetricTable } from '../components/DailyMetricTable';
import { MetricDefinitionEditor } from '../components/MetricDefinitionEditor';
import type {
  MetricDefinition,
  MetricDefinitionInput,
  MetricEntry,
  MetricValue,
} from '../domain/types.ts';
import { useMetricDefinitions } from '../hooks/data/useMetricDefinitions.ts';
import { useMetricEntries } from '../hooks/data/useMetricEntries.ts';

const TREND_COLOR = '#2563eb';
const RANGE_OPTIONS = [
  { days: 14, label: '2週間' },
  { days: 30, label: '1か月' },
  { days: 90, label: '3か月' },
];

type EditorState = { mode: 'create' } | { mode: 'edit'; definition: MetricDefinition } | null;

export function DailyLogPage(): JSX.Element {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const today = toDateKey(Date.now());
  const [rangeDays, setRangeDays] = useState(14);
  const [editor, setEditor] = useState<EditorState>(null);

  const fromKey = addDays(today, -(rangeDays - 1));
  const { definitions, saveDefinition, deleteDefinition } = useMetricDefinitions({ userId });
  const { entries, upsertEntry, deleteEntry } = useMetricEntries({ userId, fromKey, toKey: today });

  // (metricId|date) -> entry の索引
  const entryIndex = useMemo(() => {
    const map = new Map<string, MetricEntry>();
    for (const entry of entries) {
      map.set(`${entry.metricId}|${entry.entryDate}`, entry);
    }
    return map;
  }, [entries]);

  const days = useMemo(() => eachDayKey(fromKey, today).reverse(), [fromKey, today]);
  const numberDefinitions = definitions.filter((definition) => definition.kind === 'number');

  const handleCommit = (metricId: string, dateKey: string, value: MetricValue | null) => {
    if (value === null) {
      void deleteEntry(metricId, dateKey);
      return;
    }
    void upsertEntry({ metricId, entryDate: dateKey, value });
  };

  const handleSaveDefinition = async (input: MetricDefinitionInput) => {
    await saveDefinition(input);
    setEditor(null);
  };

  const handleDeleteDefinition = async (id: string) => {
    await deleteDefinition(id);
    setEditor(null);
  };

  const trendDays = useMemo(() => eachDayKey(fromKey, today), [fromKey, today]);
  const trendLabels = trendDays.map((day) => {
    const [, month, date] = day.split('-');
    return `${Number(month)}/${Number(date)}`;
  });
  const buildTrendValues = (metricId: string): (number | null)[] => {
    const byDate = new Map<string, number>();
    for (const entry of entries) {
      if (entry.metricId === metricId && typeof entry.value === 'number') {
        byDate.set(entry.entryDate, entry.value);
      }
    }
    return trendDays.map((day) => byDate.get(day) ?? null);
  };

  return (
    <main className="daily-log">
      <div className="daily-log__panel">
        <header className="daily-log__header">
          <h1>デイリー記録</h1>
          <button
            type="button"
            className="daily-log__button-primary"
            onClick={() => setEditor({ mode: 'create' })}
          >
            項目を追加
          </button>
        </header>

        {definitions.length === 0 ? (
          <p className="daily-log__empty">
            「ジムで運動する」をチェックボックス、「体重」を数値で——のように、毎日記録したい項目を追加できます。
            追加すると、この下の表に日付ごとのマスができ、そのまま入力できます。
          </p>
        ) : (
          <>
            <div className="daily-log__controls">
              <div className="daily-log__segmented" role="tablist" aria-label="表示期間">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.days}
                    type="button"
                    role="tab"
                    aria-selected={rangeDays === option.days}
                    className={`daily-log__segmented-item ${rangeDays === option.days ? 'daily-log__segmented-item--active' : ''}`}
                    onClick={() => setRangeDays(option.days)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <section className="daily-log__card" aria-label="記録テーブル">
              <DailyMetricTable
                definitions={definitions}
                days={days}
                todayKey={today}
                entryFor={(metricId, dateKey) => entryIndex.get(`${metricId}|${dateKey}`)}
                onCommit={handleCommit}
                onEditDefinition={(definition) => setEditor({ mode: 'edit', definition })}
              />
            </section>

            {numberDefinitions.map((definition) => (
              <section
                key={definition.id}
                className="daily-log__card"
                aria-label={`${definition.name}の推移`}
              >
                <h2 className="daily-log__trend-title">
                  {definition.name}の推移
                  {definition.unit ? (
                    <span className="daily-log__trend-unit">（{definition.unit}）</span>
                  ) : null}
                </h2>
                <LineChart
                  labels={trendLabels}
                  series={[
                    {
                      id: definition.id,
                      label: definition.name,
                      color: TREND_COLOR,
                      values: buildTrendValues(definition.id),
                    },
                  ]}
                  height={220}
                  formatValue={(value) => `${Math.round(value * 10) / 10}`}
                  ariaLabel={`${definition.name}の推移`}
                />
              </section>
            ))}
          </>
        )}
      </div>

      {editor ? (
        <div className="daily-log__overlay" role="dialog" aria-modal="true">
          <div className="daily-log__overlay-card">
            <MetricDefinitionEditor
              initial={editor.mode === 'edit' ? editor.definition : null}
              nextDisplayOrder={definitions.length}
              onSave={handleSaveDefinition}
              onDelete={handleDeleteDefinition}
              onCancel={() => setEditor(null)}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
