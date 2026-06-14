import { describe, expect, it } from 'vitest';
import {
  buildBudgetActualRows,
  dailyActualMinutes,
  dailyBudgetMinutes,
  type SessionLike,
} from './aggregation.ts';
import type { Budget } from './types.ts';

// 月=180分(3h), 土日=0、その他平日=180分。2025-01-06(月)〜
const budget: Budget = {
  id: 'b1',
  tag: '鍛錬',
  weekdayMinutes: [0, 180, 180, 180, 180, 180, 0], // 日,月,火,水,木,金,土
  effectiveFrom: '2025-01-06',
  effectiveTo: null,
};

const sessionAt = (dateKey: string, minutes: number, tags: string[] = ['鍛錬']): SessionLike => ({
  startedAt: new Date(`${dateKey}T10:00:00`).getTime(),
  durationSeconds: minutes * 60,
  tags,
});

describe('dailyBudgetMinutes', () => {
  it('曜日別スケジュールで日次予算を生成する', () => {
    const map = dailyBudgetMinutes(budget, '2025-01-06', '2025-01-12');
    expect(map.get('2025-01-06')).toBe(180); // 月
    expect(map.get('2025-01-11')).toBe(0); // 土
    expect(map.get('2025-01-12')).toBe(0); // 日
  });

  it('有効期間外は 0 になる', () => {
    const map = dailyBudgetMinutes(budget, '2025-01-04', '2025-01-06');
    expect(map.get('2025-01-04')).toBe(0); // effectiveFrom より前
    expect(map.get('2025-01-06')).toBe(180);
  });
});

describe('dailyActualMinutes', () => {
  it('対象タグのセッションのみ日次合計する', () => {
    const sessions = [
      sessionAt('2025-01-06', 60),
      sessionAt('2025-01-06', 30),
      sessionAt('2025-01-07', 120, ['別タグ']),
    ];
    const map = dailyActualMinutes(sessions, '鍛錬', '2025-01-06', '2025-01-07');
    expect(map.get('2025-01-06')).toBe(90);
    expect(map.get('2025-01-07')).toBe(0);
  });

  it('project が対象名に一致するセッションも拾う（web UI は project のみ記録）', () => {
    const sessions: SessionLike[] = [
      {
        startedAt: new Date('2025-01-06T10:00:00').getTime(),
        durationSeconds: 150 * 60,
        project: '鍛錬',
      },
      {
        startedAt: new Date('2025-01-06T12:00:00').getTime(),
        durationSeconds: 60 * 60,
        project: '別',
      },
    ];
    const map = dailyActualMinutes(sessions, '鍛錬', '2025-01-06', '2025-01-06');
    expect(map.get('2025-01-06')).toBe(150);
  });
});

describe('buildBudgetActualRows', () => {
  it('日次で予実差と累積を計算する', () => {
    const sessions = [sessionAt('2025-01-06', 200), sessionAt('2025-01-07', 100)];
    const rows = buildBudgetActualRows(budget, sessions, '2025-01-06', '2025-01-07', 'day');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      budgetMinutes: 180,
      actualMinutes: 200,
      varianceMinutes: 20,
      cumulativeBudgetMinutes: 180,
      cumulativeActualMinutes: 200,
    });
    expect(rows[1]).toMatchObject({
      budgetMinutes: 180,
      actualMinutes: 100,
      varianceMinutes: -80,
      cumulativeBudgetMinutes: 360,
      cumulativeActualMinutes: 300,
      cumulativeVarianceMinutes: -60,
    });
  });

  it('週次でバケットを束ねる（月曜開始）', () => {
    const sessions = [sessionAt('2025-01-06', 60), sessionAt('2025-01-08', 60)];
    const rows = buildBudgetActualRows(budget, sessions, '2025-01-06', '2025-01-12', 'week');
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2025-01-06');
    expect(rows[0].budgetMinutes).toBe(180 * 5); // 平日5日分
    expect(rows[0].actualMinutes).toBe(120);
  });

  it('月次でバケットを束ねる', () => {
    const sessions = [sessionAt('2025-01-06', 60), sessionAt('2025-02-03', 90)];
    const rows = buildBudgetActualRows(budget, sessions, '2025-01-06', '2025-02-03', 'month');
    expect(rows.map((r) => r.date)).toEqual(['2025-01-01', '2025-02-01']);
    expect(rows[1].actualMinutes).toBe(90);
  });
});
