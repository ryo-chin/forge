/**
 * テストデータファクトリー: TimeTrackerSession / SessionDraft
 * テストで一貫したデータを生成するためのユーティリティ
 */
import type { SessionDraft, TimeTrackerSession } from '@features/time-tracker/domain/types';

let sessionCounter = 0;

/**
 * TimeTrackerSession のファクトリー
 * @param overrides 上書きするプロパティ
 */
export function buildSession(overrides: Partial<TimeTrackerSession> = {}): TimeTrackerSession {
  sessionCounter++;
  const now = Date.now();
  const startedAt = now - 3600_000; // 1時間前
  const endedAt = now;

  return {
    id: `test-session-${sessionCounter}`,
    title: `テストセッション ${sessionCounter}`,
    startedAt,
    endedAt,
    durationSeconds: Math.floor((endedAt - startedAt) / 1000),
    ...overrides,
  };
}

/**
 * SessionDraft のファクトリー
 * @param overrides 上書きするプロパティ
 */
export function buildDraft(overrides: Partial<SessionDraft> = {}): SessionDraft {
  sessionCounter++;
  const now = Date.now();

  return {
    id: `test-draft-${sessionCounter}`,
    title: `テストドラフト ${sessionCounter}`,
    startedAt: now,
    ...overrides,
  };
}

/**
 * 複数のセッションを生成
 * @param count 生成数
 * @param overrides 各セッションに適用する上書きプロパティ
 */
export function buildSessions(
  count: number,
  overrides: Partial<TimeTrackerSession> = {},
): TimeTrackerSession[] {
  return Array.from({ length: count }, () => buildSession(overrides));
}

/**
 * ファクトリーのカウンターをリセット
 * テストのbeforeEachで呼び出すことで、一貫したIDを生成できる
 */
export function resetSessionFactory(): void {
  sessionCounter = 0;
}
