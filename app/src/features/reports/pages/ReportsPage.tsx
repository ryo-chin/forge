import { useMetricDefinitions, useMetricEntries } from '@features/daily-log';
import { useTimeTrackerSessions } from '@features/time-tracker/hooks/data/useTimeTrackerSessions.ts';
import { useAuth } from '@infra/auth';
import { addDays, addMonths, toDateKey } from '@lib/date.ts';
import { LineChart } from '@ui/components/LineChart';
import { RangeControl } from '@ui/components/RangeControl';
import { useMemo, useState } from 'react';
import '../reports.css';
import { BudgetActualTable } from '../components/BudgetActualTable';
import { BudgetEditor } from '../components/BudgetEditor';
import { MetricSeriesTable } from '../components/MetricSeriesTable';
import { PeriodToggle } from '../components/PeriodToggle';
import {
  buildBooleanMetricRows,
  buildBudgetActualRows,
  buildNumberMetricRows,
  type EntryLike,
  type SessionLike,
} from '../domain/aggregation.ts';
import type { Budget, BudgetInput, PeriodUnit } from '../domain/types.ts';
import { useBudgets } from '../hooks/data/useBudgets.ts';

const BUDGET_COLOR = '#2563eb';
const ACTUAL_COLOR = '#ef4444';
const METRIC_COLOR = '#2563eb';

type EditorState = { mode: 'create' } | { mode: 'edit'; budget: Budget } | null;

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function ReportsPage(): JSX.Element {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = toDateKey(Date.now());

  const [range, setRange] = useState(() => ({
    fromKey: addDays(addMonths(today, -3), 1),
    toKey: today,
  }));
  const [period, setPeriod] = useState<PeriodUnit>('week');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { sessions } = useTimeTrackerSessions({ userId });
  const { budgets, saveBudget, deleteBudget } = useBudgets({ userId });
  const { definitions } = useMetricDefinitions({ userId });
  const { entries } = useMetricEntries({ userId, fromKey: range.fromKey, toKey: range.toKey });

  // レポートで扱える記録（数値=推移 / 真偽=達成回数）
  const reportableMetrics = definitions.filter(
    (definition) => definition.kind === 'number' || definition.kind === 'boolean',
  );

  type Source =
    | { type: 'budget'; id: string; label: string; budget: Budget }
    | { type: 'metric'; id: string; label: string };
  const sources: Source[] = [
    ...budgets.map((budget) => ({
      type: 'budget' as const,
      id: `budget:${budget.id}`,
      label: budget.label ?? budget.tag,
      budget,
    })),
    ...reportableMetrics.map((definition) => ({
      type: 'metric' as const,
      id: `metric:${definition.id}`,
      label: definition.name,
    })),
  ];

  const selected = sources.find((source) => source.id === selectedId) ?? sources[0] ?? null;
  const selectedBudget = selected?.type === 'budget' ? selected.budget : null;
  const selectedMetric =
    selected?.type === 'metric'
      ? (reportableMetrics.find((definition) => `metric:${definition.id}` === selected.id) ?? null)
      : null;

  const budgetRows = useMemo(() => {
    if (!selectedBudget) return [];
    return buildBudgetActualRows(
      selectedBudget,
      sessions as SessionLike[],
      range.fromKey,
      range.toKey,
      period,
    );
  }, [selectedBudget, sessions, range, period]);

  const metricRows = useMemo(() => {
    if (!selectedMetric) return [];
    if (selectedMetric.kind === 'number') {
      return buildNumberMetricRows(
        entries as EntryLike[],
        selectedMetric.id,
        range.fromKey,
        range.toKey,
        period,
      );
    }
    return buildBooleanMetricRows(
      entries as EntryLike[],
      selectedMetric.id,
      range.fromKey,
      range.toKey,
      period,
    );
  }, [selectedMetric, entries, range, period]);

  const handleSave = async (input: BudgetInput) => {
    const saved = await saveBudget(input);
    setSelectedId(`budget:${saved.id}`);
    setEditor(null);
  };

  const handleDelete = async () => {
    if (!selectedBudget) return;
    await deleteBudget(selectedBudget.id);
    setSelectedId(null);
    setConfirmingDelete(false);
  };

  const renderBudget = (budget: Budget) => (
    <>
      <section className="reports__chart-card" aria-label="累積の予算と実績">
        <div className="reports__chart-head">
          <h2>
            累積時間の予算と実績
            <span className="reports__chart-tag">{budget.label ?? budget.tag}</span>
          </h2>
          <div className="reports__legend">
            <span className="reports__legend-item">
              <span className="reports__legend-dot" style={{ background: BUDGET_COLOR }} />
              予算
            </span>
            <span className="reports__legend-item">
              <span className="reports__legend-dot" style={{ background: ACTUAL_COLOR }} />
              実績
            </span>
          </div>
        </div>
        {budgetRows.length === 0 ? (
          <p className="reports__empty">この期間に表示できるデータがありません。</p>
        ) : (
          <LineChart
            labels={budgetRows.map((row) => row.label)}
            series={[
              {
                id: 'budget',
                label: '予算',
                color: BUDGET_COLOR,
                values: budgetRows.map((row) => row.cumulativeBudgetMinutes / 60),
              },
              {
                id: 'actual',
                label: '実績',
                color: ACTUAL_COLOR,
                values: budgetRows.map((row) => row.cumulativeActualMinutes / 60),
              },
            ]}
            yBaseline="zero"
            formatValue={(value) => `${Math.round(value)}h`}
            ariaLabel="累積時間の予算と実績"
          />
        )}
      </section>
      <section className="reports__table-card" aria-label="予実テーブル">
        <BudgetActualTable rows={budgetRows} />
      </section>
      <div className="reports__budget-actions">
        <button
          type="button"
          className="reports__button-ghost"
          onClick={() => setEditor({ mode: 'edit', budget })}
        >
          予算を編集
        </button>
        {confirmingDelete ? (
          <span className="reports__confirm">
            削除しますか？
            <button type="button" className="reports__button-danger" onClick={handleDelete}>
              削除する
            </button>
            <button
              type="button"
              className="reports__button-ghost"
              onClick={() => setConfirmingDelete(false)}
            >
              やめる
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="reports__button-ghost"
            onClick={() => setConfirmingDelete(true)}
          >
            予算を削除
          </button>
        )}
      </div>
    </>
  );

  const renderMetric = () => {
    if (!selectedMetric) return null;
    const isNumber = selectedMetric.kind === 'number';
    const unit = selectedMetric.unit ?? '';
    const valueHeader = isNumber ? (unit ? `平均（${unit}）` : '平均') : '達成回数';
    return (
      <>
        <section className="reports__chart-card" aria-label={`${selectedMetric.name}の推移`}>
          <div className="reports__chart-head">
            <h2>
              {selectedMetric.name}
              <span className="reports__chart-tag">
                {isNumber ? '推移' : '達成回数'}
                {isNumber && unit ? `（${unit}）` : ''}
              </span>
            </h2>
          </div>
          {metricRows.length === 0 ? (
            <p className="reports__empty">この期間に表示できるデータがありません。</p>
          ) : (
            <LineChart
              labels={metricRows.map((row) => row.label)}
              series={[
                {
                  id: selectedMetric.id,
                  label: selectedMetric.name,
                  color: METRIC_COLOR,
                  values: metricRows.map((row) => (row.value == null ? null : round1(row.value))),
                },
              ]}
              yBaseline={isNumber ? 'auto' : 'zero'}
              formatValue={(value) => (isNumber ? String(round1(value)) : `${Math.round(value)}`)}
              ariaLabel={`${selectedMetric.name}の推移`}
            />
          )}
        </section>
        <section className="reports__table-card" aria-label={`${selectedMetric.name}のテーブル`}>
          <MetricSeriesTable
            rows={metricRows}
            valueHeader={valueHeader}
            formatValue={(value) =>
              isNumber ? `${round1(value)}${unit ? ` ${unit}` : ''}` : `${Math.round(value)}回`
            }
          />
        </section>
      </>
    );
  };

  return (
    <main className="reports">
      <div className="reports__panel">
        <header className="reports__header">
          <h1>レポート</h1>
          <button
            type="button"
            className="reports__button-primary"
            onClick={() => setEditor({ mode: 'create' })}
          >
            予算を追加
          </button>
        </header>

        {sources.length === 0 ? (
          <p className="reports__empty">
            プロジェクト単位で予算を設定すると、累積の予算曲線と実績、予実差を確認できます。
            「予算を追加」から始めましょう。デイリー記録（数値・チェック）も、記録すればここに表示されます。
          </p>
        ) : (
          <>
            <div className="reports__source-row">
              {budgets.length > 0 ? (
                <div className="reports__source-group">
                  <span className="reports__source-label">予実</span>
                  <div className="reports__budget-tabs" role="tablist" aria-label="予実">
                    {sources
                      .filter((source) => source.type === 'budget')
                      .map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          role="tab"
                          aria-selected={source.id === selected?.id}
                          className={`reports__budget-tab ${source.id === selected?.id ? 'reports__budget-tab--active' : ''}`}
                          onClick={() => {
                            setSelectedId(source.id);
                            setConfirmingDelete(false);
                          }}
                        >
                          {source.label}
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
              {reportableMetrics.length > 0 ? (
                <div className="reports__source-group">
                  <span className="reports__source-label">記録</span>
                  <div className="reports__budget-tabs" role="tablist" aria-label="デイリー記録">
                    {sources
                      .filter((source) => source.type === 'metric')
                      .map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          role="tab"
                          aria-selected={source.id === selected?.id}
                          className={`reports__budget-tab ${source.id === selected?.id ? 'reports__budget-tab--active' : ''}`}
                          onClick={() => {
                            setSelectedId(source.id);
                            setConfirmingDelete(false);
                          }}
                        >
                          {source.label}
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="reports__controls">
              <RangeControl
                fromKey={range.fromKey}
                toKey={range.toKey}
                todayKey={today}
                onChange={(fromKey, toKey) => setRange({ fromKey, toKey })}
              />
              <PeriodToggle value={period} onChange={setPeriod} />
            </div>

            {selectedBudget ? renderBudget(selectedBudget) : null}
            {selectedMetric ? renderMetric() : null}
          </>
        )}
      </div>

      {editor ? (
        <div className="reports__overlay" role="dialog" aria-modal="true">
          <div className="reports__overlay-card">
            <BudgetEditor
              initial={editor.mode === 'edit' ? editor.budget : null}
              onSave={handleSave}
              onCancel={() => setEditor(null)}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
