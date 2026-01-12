/**
 * TimeTrackerDataSource のモック実装
 * テストでinfra層を分離するためのユーティリティ
 */
import { initialRunningSessionState } from '@features/time-tracker/domain/runningSession';
import type { RunningSessionState, TimeTrackerSession } from '@features/time-tracker/domain/types';
import type { TimeTrackerDataSource } from '@infra/repository/TimeTracker/types';
import { vi } from 'vitest';

export type MockDataSourceOptions = {
  sessions?: TimeTrackerSession[];
  runningState?: RunningSessionState | null;
  mode?: 'local' | 'supabase';
};

/**
 * TimeTrackerDataSource のモックを生成
 */
export function createMockDataSource(options: MockDataSourceOptions = {}): TimeTrackerDataSource & {
  // テスト用のヘルパー
  _setSessions: (sessions: TimeTrackerSession[]) => void;
  _setRunningState: (state: RunningSessionState | null) => void;
} {
  let sessions = options.sessions ?? [];
  let runningState = options.runningState ?? null;

  return {
    mode: options.mode ?? 'local',
    get initialSessions() {
      return sessions;
    },
    get initialRunningState() {
      return runningState;
    },
    fetchSessions: vi.fn(async () => sessions),
    fetchRunningState: vi.fn(async () => runningState),
    persistSessions: vi.fn(async (newSessions: TimeTrackerSession[]) => {
      sessions = newSessions;
    }),
    persistRunningState: vi.fn(async (state: RunningSessionState) => {
      runningState = state;
    }),
    _setSessions: (newSessions: TimeTrackerSession[]) => {
      sessions = newSessions;
    },
    _setRunningState: (state: RunningSessionState | null) => {
      runningState = state;
    },
  };
}

/**
 * 空のDataSourceモック
 */
export function createEmptyMockDataSource(): TimeTrackerDataSource {
  return createMockDataSource({
    sessions: [],
    runningState: initialRunningSessionState,
  });
}
