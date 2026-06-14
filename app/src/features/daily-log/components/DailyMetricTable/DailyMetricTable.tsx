import { useEffect, useState } from 'react';
import type { MetricDefinition, MetricEntry, MetricValue } from '../../domain/types.ts';

type DailyMetricTableProps = {
  definitions: MetricDefinition[];
  days: string[]; // 表示する日付キー（新しい順）
  todayKey: string;
  entryFor: (metricId: string, dateKey: string) => MetricEntry | undefined;
  onCommit: (metricId: string, dateKey: string, value: MetricValue | null) => void;
  onEditDefinition: (definition: MetricDefinition) => void;
};

const formatDayLabel = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-');
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][new Date(`${dateKey}T00:00:00`).getDay()];
  return `${Number(month)}/${Number(day)}(${weekday})`;
};

/** 数値・テキストの入力セル（編集中はローカル下書き、確定は blur / Enter）。 */
function EditableCell({
  kind,
  value,
  onCommit,
}: {
  kind: 'number' | 'text';
  value: MetricValue | undefined;
  onCommit: (value: MetricValue | null) => void;
}): JSX.Element {
  const initial = value == null ? '' : String(value);
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    setDraft(value == null ? '' : String(value));
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      onCommit(null);
      return;
    }
    if (kind === 'number') {
      const parsed = Number.parseFloat(trimmed);
      onCommit(Number.isFinite(parsed) ? parsed : null);
      return;
    }
    onCommit(trimmed);
  };

  return (
    <input
      className={`daily-log__cell-input ${kind === 'number' ? 'daily-log__cell-input--number' : ''}`}
      type={kind === 'number' ? 'number' : 'text'}
      inputMode={kind === 'number' ? 'decimal' : undefined}
      step={kind === 'number' ? 'any' : undefined}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      placeholder="—"
    />
  );
}

export function DailyMetricTable({
  definitions,
  days,
  todayKey,
  entryFor,
  onCommit,
  onEditDefinition,
}: DailyMetricTableProps): JSX.Element {
  return (
    <div className="daily-log__table-wrap">
      <table className="daily-log__table">
        <thead>
          <tr>
            <th className="daily-log__th-date">日付</th>
            {definitions.map((definition) => (
              <th key={definition.id}>
                <button
                  type="button"
                  className="daily-log__col-head"
                  onClick={() => onEditDefinition(definition)}
                  title="項目を編集"
                >
                  {definition.name}
                  {definition.unit ? (
                    <span className="daily-log__col-unit">（{definition.unit}）</span>
                  ) : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((dateKey) => (
            <tr key={dateKey} className={dateKey === todayKey ? 'daily-log__row--today' : ''}>
              <th className="daily-log__td-date" scope="row">
                {formatDayLabel(dateKey)}
              </th>
              {definitions.map((definition) => {
                const entry = entryFor(definition.id, dateKey);
                const value = entry?.value;
                return (
                  <td key={definition.id} className="daily-log__cell">
                    {definition.kind === 'boolean' ? (
                      <input
                        type="checkbox"
                        className="daily-log__cell-check"
                        checked={value === true}
                        onChange={(event) =>
                          onCommit(definition.id, dateKey, event.target.checked ? true : null)
                        }
                        aria-label={`${definition.name} ${formatDayLabel(dateKey)}`}
                      />
                    ) : definition.kind === 'single_select' ? (
                      <select
                        className="daily-log__cell-select"
                        value={typeof value === 'string' ? value : ''}
                        onChange={(event) =>
                          onCommit(definition.id, dateKey, event.target.value || null)
                        }
                        aria-label={`${definition.name} ${formatDayLabel(dateKey)}`}
                      >
                        <option value="">—</option>
                        {(definition.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : definition.kind === 'number' || definition.kind === 'text' ? (
                      <EditableCell
                        kind={definition.kind}
                        value={value}
                        onCommit={(next) => onCommit(definition.id, dateKey, next)}
                      />
                    ) : (
                      <span className="daily-log__unsupported">準備中</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
