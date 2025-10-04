import type {
  RunningSessionState,
  TimeTrackerSession,
} from '@features/time-tracker/domain/types.ts';

export type TimeTrackerDataSource = {
  readonly mode: 'local' | 'supabase';
  readonly initialSessions: TimeTrackerSession[];
  readonly initialRunningState: RunningSessionState | null;
  fetchSessions: () => Promise<TimeTrackerSession[]>;
  fetchRunningState: () => Promise<RunningSessionState | null>;
  persistSessions: (sessions: TimeTrackerSession[]) => Promise<void>;
  persistRunningState: (state: RunningSessionState) => Promise<void>;
};

export type CreateDataSourceOptions = {
  now?: () => number;
};
