import { describe, expect, it } from 'vitest';
import type { TimeTrackerSession } from '../../domain/types.ts';
import { describeHistorySession, filterHistorySessions, formatHistoryTimeRange } from './logic.ts';

const session = (
  input: Pick<TimeTrackerSession, 'startedAt' | 'endedAt' | 'durationSeconds'> &
    Partial<TimeTrackerSession>,
): TimeTrackerSession => ({
  id: 'session-1',
  title: '戦略OS',
  project: 'AI駆動開発',
  ...input,
});

describe('HistoryList logic', () => {
  it('同日の開始時刻と終了時刻を日付付きで表示する', () => {
    expect(
      formatHistoryTimeRange(
        session({
          startedAt: new Date(2026, 4, 1, 20, 30).getTime(),
          endedAt: new Date(2026, 4, 1, 22, 0).getTime(),
          durationSeconds: 5400,
        }),
      ),
    ).toBe('5/1 20:30 - 22:00');
  });

  it('日跨ぎの終了時刻には終了日も表示する', () => {
    expect(
      formatHistoryTimeRange(
        session({
          startedAt: new Date(2026, 4, 1, 23, 30).getTime(),
          endedAt: new Date(2026, 4, 2, 0, 15).getTime(),
          durationSeconds: 2700,
        }),
      ),
    ).toBe('5/1 23:30 - 5/2 00:15');
  });

  it('ARIA説明にも記録時間を含める', () => {
    expect(
      describeHistorySession(
        session({
          startedAt: new Date(2026, 4, 1, 20, 30).getTime(),
          endedAt: new Date(2026, 4, 1, 22, 0).getTime(),
          durationSeconds: 5400,
        }),
      ),
    ).toContain('記録時間 5/1 20:30 - 22:00');
  });

  it('タイトル、プロジェクト、タグ、メモで履歴を絞り込める', () => {
    const sessions = [
      session({
        id: 'session-1',
        title: '戦略OS',
        project: 'AI駆動開発',
        tags: ['mcp'],
        notes: 'Forge履歴',
        startedAt: new Date(2026, 4, 1, 20, 30).getTime(),
        endedAt: new Date(2026, 4, 1, 22, 0).getTime(),
        durationSeconds: 5400,
      }),
      session({
        id: 'session-2',
        title: '読書',
        project: 'learning',
        tags: ['book'],
        notes: '数理最適化',
        startedAt: new Date(2026, 4, 1, 22, 30).getTime(),
        endedAt: new Date(2026, 4, 1, 23, 0).getTime(),
        durationSeconds: 1800,
      }),
    ];

    expect(filterHistorySessions(sessions, '#AI駆動開発 #mcp Forge')).toEqual([sessions[0]]);
    expect(filterHistorySessions(sessions, 'learning book')).toEqual([sessions[1]]);
  });
});
