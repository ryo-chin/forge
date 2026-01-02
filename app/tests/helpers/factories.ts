/**
 * テストデータファクトリ
 *
 * テストで使用するダミーデータを生成するためのファクトリ関数群。
 * 各ファクトリはデフォルト値を持ち、部分的なオーバーライドが可能。
 */

import type { RunningSessionState, SessionDraft, TimeTrackerSession } from '@features/time-tracker';

/**
 * TimeTrackerSessionのファクトリ
 * 完了済みセッションを生成する
 */
export function createSession(overrides: Partial<TimeTrackerSession> = {}): TimeTrackerSession {
  const startedAt = overrides.startedAt ?? Date.now() - 3600_000;
  const endedAt = overrides.endedAt ?? Date.now();
  const durationSeconds = overrides.durationSeconds ?? Math.floor((endedAt - startedAt) / 1000);

  return {
    id: `session-${crypto.randomUUID()}`,
    title: 'テストセッション',
    startedAt,
    endedAt,
    durationSeconds,
    ...overrides,
  };
}

/**
 * SessionDraftのファクトリ
 * 実行中セッションの下書きを生成する
 */
export function createSessionDraft(overrides: Partial<SessionDraft> = {}): SessionDraft {
  return {
    id: `draft-${crypto.randomUUID()}`,
    title: 'テスト作業',
    startedAt: Date.now(),
    ...overrides,
  };
}

/**
 * RunningSessionStateのファクトリ
 * idle状態またはrunning状態を生成する
 */
export function createRunningSessionState(
  status: 'idle' | 'running' = 'idle',
  draftOverrides: Partial<SessionDraft> = {},
): RunningSessionState {
  if (status === 'idle') {
    return {
      status: 'idle',
      draft: null,
      elapsedSeconds: 0,
    };
  }

  return {
    status: 'running',
    draft: createSessionDraft(draftOverrides),
    elapsedSeconds: 0,
  };
}

/**
 * 複数のセッションを一括生成する
 * テストで履歴データが必要な場合に使用
 */
export function createSessions(
  count: number,
  overridesFactory?: (index: number) => Partial<TimeTrackerSession>,
): TimeTrackerSession[] {
  return Array.from({ length: count }, (_, index) =>
    createSession({
      title: `セッション ${index + 1}`,
      ...(overridesFactory?.(index) ?? {}),
    }),
  );
}
