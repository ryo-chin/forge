import { describe, expect, it } from 'vitest';
import type { TimeTrackerSession } from '../../domain/types.ts';
import { describeHistorySession, formatHistoryTimeRange } from './logic.ts';

const session = (
  input: Pick<TimeTrackerSession, 'startedAt' | 'endedAt' | 'durationSeconds'>,
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
});
