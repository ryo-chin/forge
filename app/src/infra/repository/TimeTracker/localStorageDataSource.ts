import {
  loadStoredRunningState,
  loadStoredSessions,
  saveRunningState,
  saveSessions,
} from '../../localstorage/timeTrackerStorage.ts';
import { parseRunningDraft, parseSession } from '../../../features/time-tracker/domain/sessionParsers.ts';
import type {
  RunningSessionState,
  TimeTrackerSession,
} from '../../../features/time-tracker/domain/types.ts';
import type {
  CreateDataSourceOptions,
  TimeTrackerDataSource,
} from './types.ts';

const computeRunningState = (
  now: () => number,
): RunningSessionState | null => {
  const stored = loadStoredRunningState(parseRunningDraft, now);
  if (!stored) {
    return null;
  }
  return {
    status: 'running',
    draft: stored.draft,
    elapsedSeconds: stored.elapsedSeconds,
  };
};

const readSessions = (): TimeTrackerSession[] =>
  loadStoredSessions(parseSession);

export const createLocalStorageDataSource = (
  options: CreateDataSourceOptions = {},
): TimeTrackerDataSource => {
  const { now = () => Date.now() } = options;

  const initialSessions = readSessions();
  const initialRunningState = computeRunningState(now);

  return {
    mode: 'local',
    initialSessions,
    initialRunningState,
    fetchSessions: async () => readSessions(),
    fetchRunningState: async () => computeRunningState(now),
    persistSessions: async (sessions) => {
      saveSessions(sessions);
    },
    persistRunningState: async (state) => {
      saveRunningState(state);
    },
  };
};
