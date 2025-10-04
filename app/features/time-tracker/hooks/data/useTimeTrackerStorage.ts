import { useCallback, useMemo } from 'react';
import {
  loadStoredSessions,
  loadStoredRunningState,
  saveRunningState,
  saveSessions,
} from '@infra/localstorage/timeTrackerStorage';
import { parseRunningDraft, parseSession } from '@features/time-tracker/domain/sessionParsers';
import type {
  RunningSessionState,
  TimeTrackerSession,
} from '@features/time-tracker/domain/types.ts';

type PersistedRunningState = RunningSessionState;

const defaultNow = () => Date.now();

export const useTimeTrackerStorage = (now: () => number = defaultNow)=> {
  const { initialSessions, initialRunningState } = useMemo(() => {
    const sessions = loadStoredSessions(parseSession);
    const running = loadStoredRunningState(parseRunningDraft, now);
    const runningState: PersistedRunningState | null = running
      ? {
          status: 'running',
          draft: running.draft,
          elapsedSeconds: running.elapsedSeconds,
        }
      : null;
    return {
      initialSessions: sessions,
      initialRunningState: runningState,
    };
  }, [now]);

  const persistSessions = useCallback((sessions: TimeTrackerSession[]) => {
    saveSessions(sessions);
  }, []);

  const persistRunningState = useCallback((state: RunningSessionState) => {
    saveRunningState(state);
  }, []);

  return {
    initialSessions,
    initialRunningState,
    persistSessions,
    persistRunningState,
  };
};
