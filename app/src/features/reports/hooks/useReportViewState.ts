import { addDays, addMonths } from '@lib/date.ts';
import { useEffect, useState } from 'react';
import type { PeriodUnit } from '../domain/types.ts';

/**
 * レポート画面の表示状態（対象・期間・粒度）を URL クエリと localStorage に保持する。
 * 優先順位は URL クエリ > localStorage > デフォルト。
 * 変更時は履歴を汚さないよう replaceState で URL を更新し、localStorage にも保存する。
 * カスタムルーター（src/router）は search を参照しないため、ここで直接 URL を操作しても競合しない。
 */

const STORAGE_KEY = 'forge:reports-view';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS: PeriodUnit[] = ['day', 'week', 'month'];

export type ReportRange = { fromKey: string; toKey: string };

export type ReportViewState = {
  selectedId: string | null;
  range: ReportRange;
  period: PeriodUnit;
};

const isDateKey = (value: unknown): value is string =>
  typeof value === 'string' && DATE_PATTERN.test(value);

const isPeriod = (value: unknown): value is PeriodUnit =>
  typeof value === 'string' && PERIODS.includes(value as PeriodUnit);

const defaultState = (today: string): ReportViewState => ({
  selectedId: null,
  range: { fromKey: addDays(addMonths(today, -3), 1), toKey: today },
  period: 'week',
});

const fromSearchParams = (params: URLSearchParams): Partial<ReportViewState> => {
  const result: Partial<ReportViewState> = {};
  const view = params.get('view');
  if (view) result.selectedId = view;
  const from = params.get('from');
  const to = params.get('to');
  if (isDateKey(from) && isDateKey(to)) result.range = { fromKey: from, toKey: to };
  const period = params.get('period');
  if (isPeriod(period)) result.period = period;
  return result;
};

const fromStorage = (): Partial<ReportViewState> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Partial<ReportViewState> = {};
    if (typeof parsed.selectedId === 'string') result.selectedId = parsed.selectedId;
    const range = parsed.range as Record<string, unknown> | undefined;
    if (range && isDateKey(range.fromKey) && isDateKey(range.toKey)) {
      result.range = { fromKey: range.fromKey, toKey: range.toKey };
    }
    if (isPeriod(parsed.period)) result.period = parsed.period;
    return result;
  } catch {
    return {};
  }
};

const readInitialState = (today: string): ReportViewState => {
  const base = defaultState(today);
  const stored = fromStorage();
  const url =
    typeof window === 'undefined'
      ? {}
      : fromSearchParams(new URLSearchParams(window.location.search));
  // URL > localStorage > デフォルト
  return { ...base, ...stored, ...url };
};

const persist = (state: ReportViewState): void => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (state.selectedId) params.set('view', state.selectedId);
  else params.delete('view');
  params.set('from', state.range.fromKey);
  params.set('to', state.range.toKey);
  params.set('period', state.period);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState(null, '', url);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage 不可（プライベートモード等）は無視
  }
};

export const useReportViewState = (today: string) => {
  const [state] = useState<ReportViewState>(() => readInitialState(today));
  const [selectedId, setSelectedId] = useState<string | null>(state.selectedId);
  const [range, setRange] = useState<ReportRange>(state.range);
  const [period, setPeriod] = useState<PeriodUnit>(state.period);

  useEffect(() => {
    persist({ selectedId, range, period });
  }, [selectedId, range, period]);

  return { selectedId, setSelectedId, range, setRange, period, setPeriod };
};
