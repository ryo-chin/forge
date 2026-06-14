import { eachDayKey, monthStartKey, toDateKey, weekdayIndex, weekStartKey } from '@lib/date.ts';
import type { Budget, BudgetActualRow, PeriodUnit } from './types.ts';

/**
 * 集計に必要なセッションの最小形（features 間結合を避けるため構造的に受ける）。
 * startedAt はミリ秒タイムスタンプ、durationSeconds は秒。
 * tags / project どちらで分類しても拾えるよう両方を見る。
 */
export type SessionLike = {
  startedAt: number;
  durationSeconds: number;
  tags?: string[];
  project?: string | null;
};

/** セッションが予算の対象（tag）に該当するか。タグ一致 or プロジェクト一致で拾う。 */
const matchesTag = (session: SessionLike, tag: string): boolean =>
  (session.tags?.includes(tag) ?? false) || session.project === tag;

/** デイリー記録の最小形 */
export type EntryLike = {
  metricId: string;
  entryDate: string; // 'YYYY-MM-DD'
  value: boolean | number | string | string[];
};

export type Bucket = {
  key: string; // バケット開始日 'YYYY-MM-DD'
  label: string;
  dayKeys: string[];
};

export type MetricSeriesRow = {
  date: string;
  label: string;
  value: number | null;
};

const minutesFromSeconds = (seconds: number): number => seconds / 60;

const bucketStartKey = (dayKey: string, unit: PeriodUnit, weekStartsOn: number): string => {
  if (unit === 'day') return dayKey;
  if (unit === 'week') return weekStartKey(dayKey, weekStartsOn);
  return monthStartKey(dayKey);
};

const formatBucketLabel = (bucketKey: string, unit: PeriodUnit, withYear: boolean): string => {
  const [year, month, day] = bucketKey.split('-');
  const m = Number(month);
  const d = Number(day);
  if (unit === 'month') return `${year}/${month}`;
  if (unit === 'week') return withYear ? `${year}/${m}/${d}週` : `${m}/${d}週`;
  return withYear ? `${year}/${m}/${d}` : `${m}/${d}`;
};

/** 期間・単位から、順序付きのバケット（各バケットに含まれる日付キー）を作る。 */
export const buildBuckets = (
  fromKey: string,
  toKey: string,
  unit: PeriodUnit,
  options: { weekStartsOn?: number; withYear?: boolean } = {},
): Bucket[] => {
  const weekStartsOn = options.weekStartsOn ?? 1;
  const withYear = options.withYear ?? fromKey.slice(0, 4) !== toKey.slice(0, 4);
  const buckets = new Map<string, Bucket>();
  const order: string[] = [];
  for (const dayKey of eachDayKey(fromKey, toKey)) {
    const key = bucketStartKey(dayKey, unit, weekStartsOn);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, label: formatBucketLabel(key, unit, withYear), dayKeys: [] };
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.dayKeys.push(dayKey);
  }
  return order.map((key) => buckets.get(key) as Bucket);
};

/** tag を含むセッションを日次でバケットし、各日の実績「分」を返す（範囲内は 0 で初期化）。 */
export const dailyActualMinutes = (
  sessions: SessionLike[],
  tag: string,
  fromKey: string,
  toKey: string,
): Map<string, number> => {
  const map = new Map<string, number>();
  for (const key of eachDayKey(fromKey, toKey)) {
    map.set(key, 0);
  }
  for (const session of sessions) {
    if (!matchesTag(session, tag)) continue;
    const key = toDateKey(session.startedAt);
    if (key < fromKey || key > toKey) continue;
    map.set(key, (map.get(key) ?? 0) + minutesFromSeconds(session.durationSeconds));
  }
  return map;
};

/** 曜日別スケジュールと有効期間から、各日の予算「分」を返す。 */
export const dailyBudgetMinutes = (
  budget: Budget,
  fromKey: string,
  toKey: string,
): Map<string, number> => {
  const map = new Map<string, number>();
  for (const key of eachDayKey(fromKey, toKey)) {
    const inRange =
      key >= budget.effectiveFrom && (budget.effectiveTo == null || key <= budget.effectiveTo);
    const minutes = inRange ? (budget.weekdayMinutes[weekdayIndex(key)] ?? 0) : 0;
    map.set(key, minutes);
  }
  return map;
};

/**
 * 予算とセッションから、指定期間・単位の予実行を生成する。
 * 期間別の予算/実績/差に加えて累積も持つ。累積は範囲内での積み上げ。
 */
export const buildBudgetActualRows = (
  budget: Budget,
  sessions: SessionLike[],
  fromKey: string,
  toKey: string,
  unit: PeriodUnit,
  options: { weekStartsOn?: number; withYear?: boolean } = {},
): BudgetActualRow[] => {
  const budgetDaily = dailyBudgetMinutes(budget, fromKey, toKey);
  const actualDaily = dailyActualMinutes(sessions, budget.tag, fromKey, toKey);
  const buckets = buildBuckets(fromKey, toKey, unit, options);

  let cumulativeBudget = 0;
  let cumulativeActual = 0;
  return buckets.map((bucket) => {
    let budgetMinutes = 0;
    let actualMinutes = 0;
    for (const dayKey of bucket.dayKeys) {
      budgetMinutes += budgetDaily.get(dayKey) ?? 0;
      actualMinutes += actualDaily.get(dayKey) ?? 0;
    }
    cumulativeBudget += budgetMinutes;
    cumulativeActual += actualMinutes;
    return {
      date: bucket.key,
      label: bucket.label,
      budgetMinutes,
      actualMinutes,
      varianceMinutes: actualMinutes - budgetMinutes,
      cumulativeBudgetMinutes: cumulativeBudget,
      cumulativeActualMinutes: cumulativeActual,
      cumulativeVarianceMinutes: cumulativeActual - cumulativeBudget,
    };
  });
};

const collectEntryDaily = (
  entries: EntryLike[],
  metricId: string,
  fromKey: string,
  toKey: string,
): Map<string, EntryLike> => {
  const map = new Map<string, EntryLike>();
  for (const entry of entries) {
    if (entry.metricId !== metricId) continue;
    if (entry.entryDate < fromKey || entry.entryDate > toKey) continue;
    map.set(entry.entryDate, entry);
  }
  return map;
};

/** 数値メトリクスをバケット平均で集計する（記録のない日は除外、なければ null）。 */
export const buildNumberMetricRows = (
  entries: EntryLike[],
  metricId: string,
  fromKey: string,
  toKey: string,
  unit: PeriodUnit,
  options: { weekStartsOn?: number; withYear?: boolean } = {},
): MetricSeriesRow[] => {
  const daily = collectEntryDaily(entries, metricId, fromKey, toKey);
  return buildBuckets(fromKey, toKey, unit, options).map((bucket) => {
    const nums: number[] = [];
    for (const dayKey of bucket.dayKeys) {
      const entry = daily.get(dayKey);
      if (entry && typeof entry.value === 'number') nums.push(entry.value);
    }
    const value =
      nums.length > 0 ? nums.reduce((sum, n) => sum + n, 0) / nums.length : null;
    return { date: bucket.key, label: bucket.label, value };
  });
};

/** 真偽メトリクスをバケット内の達成回数（true の日数）で集計する。 */
export const buildBooleanMetricRows = (
  entries: EntryLike[],
  metricId: string,
  fromKey: string,
  toKey: string,
  unit: PeriodUnit,
  options: { weekStartsOn?: number; withYear?: boolean } = {},
): MetricSeriesRow[] => {
  const daily = collectEntryDaily(entries, metricId, fromKey, toKey);
  return buildBuckets(fromKey, toKey, unit, options).map((bucket) => {
    let count = 0;
    for (const dayKey of bucket.dayKeys) {
      if (daily.get(dayKey)?.value === true) count += 1;
    }
    return { date: bucket.key, label: bucket.label, value: count };
  });
};
