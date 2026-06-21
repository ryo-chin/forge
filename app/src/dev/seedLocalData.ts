// ローカル検証用のサンプルデータ投入（dev 専用 / local モードのみ）。
// 本番ビルドには含めない（DevToolbar 側で import.meta.env.DEV ガード）。
// 既存のデータソース公開 API 経由で書き込むため、localStorage のキー形式に依存しない。

import type { TimeTrackerSession } from '@features/time-tracker/domain/types.ts';
import { detectTimeDataSourceMode } from '@infra/config';
import { createBudgetsDataSource } from '@infra/repository/Budgets';
import { createDailyMetricsDataSource } from '@infra/repository/DailyMetrics';
import { createTimeTrackerDataSource } from '@infra/repository/TimeTracker';
import { addDays, addMonths, eachDayKey, toDateKey } from '@lib/date.ts';

const STRATEGY = '戦略策定';
const SIDE = '副業';

const startMsOf = (dateKey: string, hour = 10): number =>
  new Date(`${dateKey}T${String(hour).padStart(2, '0')}:00:00`).getTime();

const session = (
  dateKey: string,
  project: string,
  hours: number,
  hour = 10,
): TimeTrackerSession => {
  const startedAt = startMsOf(dateKey, hour);
  const durationSeconds = Math.round(hours * 3600);
  return {
    id: crypto.randomUUID(),
    title: `${project} ${dateKey}`,
    startedAt,
    endedAt: startedAt + durationSeconds * 1000,
    durationSeconds,
    project,
  };
};

const isWeekday = (dateKey: string): boolean => {
  const day = new Date(`${dateKey}T00:00:00`).getDay();
  return day !== 0 && day !== 6;
};

/** local モードの localStorage に、3機能を確認できるサンプルデータを投入する。 */
export const seedLocalData = async (): Promise<void> => {
  if (detectTimeDataSourceMode() !== 'local') {
    console.warn('[forge dev] local モードでないため seed をスキップしました');
    return;
  }

  const today = toDateKey(Date.now());

  // --- デイリー記録の項目（①並び替え／推移グラフ用）。local パーサ非対応の text は使わない ---
  const metrics = createDailyMetricsDataSource({ userId: null });
  const defs = [
    { name: '血圧 上', kind: 'number' as const, unit: 'mmHg' },
    { name: '血圧 下', kind: 'number' as const, unit: 'mmHg' },
    { name: '運動', kind: 'boolean' as const, unit: null },
    { name: '脈拍', kind: 'number' as const, unit: 'bpm' },
    { name: 'ストレッチ', kind: 'boolean' as const, unit: null },
  ];
  const savedDefs = await Promise.all(
    defs.map((def, index) =>
      metrics.saveDefinition({
        name: def.name,
        kind: def.kind,
        unit: def.unit,
        displayOrder: index,
      }),
    ),
  );
  const [bpHigh, bpLow, exercise, pulse, stretch] = savedDefs;

  // 直近14日ぶんの記録（ところどころ欠けさせて実データっぽく）
  for (let i = 0; i < 14; i += 1) {
    const date = addDays(today, -i);
    const skip = i === 3 || i === 4; // 数値は2日欠測
    if (!skip) {
      await metrics.upsertEntry({
        metricId: bpHigh.id,
        entryDate: date,
        value: 108 + ((i * 3) % 18),
      });
      await metrics.upsertEntry({
        metricId: bpLow.id,
        entryDate: date,
        value: 68 + ((i * 2) % 12),
      });
      await metrics.upsertEntry({
        metricId: pulse.id,
        entryDate: date,
        value: 70 + ((i * 5) % 16),
      });
    }
    if (i % 2 === 0)
      await metrics.upsertEntry({ metricId: exercise.id, entryDate: date, value: true });
    if (i % 3 === 0)
      await metrics.upsertEntry({ metricId: stretch.id, entryDate: date, value: true });
  }

  // --- 予算（②実績の起点／予実グラフ用） ---
  const budgets = createBudgetsDataSource();
  // 「戦略策定」は7日前開始。過去の同名セッション（後述）を実績に含めないことを確認できる。
  await budgets.saveBudget({
    tag: STRATEGY,
    label: STRATEGY,
    weekdayMinutes: [0, 180, 180, 180, 180, 180, 0], // 日..土。平日3h
    effectiveFrom: addDays(today, -7),
    effectiveTo: null,
  });
  await budgets.saveBudget({
    tag: SIDE,
    label: SIDE,
    weekdayMinutes: [120, 0, 0, 0, 0, 0, 120], // 土日2h
    effectiveFrom: addDays(today, -14),
    effectiveTo: null,
  });

  // --- セッション（実績）---
  const sessions: TimeTrackerSession[] = [];
  // 予算開始よりずっと前（3か月前〜8日前）の「戦略策定」セッション = 過去の積み上げ。
  // 修正後はこれらが累積実績に混入しないことを確認できる。
  const oldDays = eachDayKey(addMonths(today, -3), addDays(today, -8));
  oldDays.forEach((date, index) => {
    if (index % 3 === 0) sessions.push(session(date, STRATEGY, 5)); // 5h ずつ ≒ 計150h規模
  });
  // 予算開始後（直近7日）の平日「戦略策定」セッション = 本来カウントしたい実績。
  for (let i = 6; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    if (isWeekday(date)) sessions.push(session(date, STRATEGY, 2, 14));
  }
  // 「副業」の土日セッション
  for (let i = 14; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    if (!isWeekday(date)) sessions.push(session(date, SIDE, 1.5, 21));
  }

  const timeTracker = createTimeTrackerDataSource({ userId: null });
  await timeTracker.persistSessions(sessions);
};

/** local モードのサンプルデータを全消去する。 */
export const resetLocalData = async (): Promise<void> => {
  if (detectTimeDataSourceMode() !== 'local') return;

  const timeTracker = createTimeTrackerDataSource({ userId: null });
  await timeTracker.persistSessions([]);

  const budgets = createBudgetsDataSource();
  for (const budget of await budgets.listBudgets()) {
    await budgets.deleteBudget(budget.id);
  }

  const metrics = createDailyMetricsDataSource({ userId: null });
  for (const def of await metrics.listDefinitions()) {
    await metrics.deleteDefinition(def.id); // 関連 entry も削除される
  }
};
