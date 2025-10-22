import { useCallback, useMemo, useReducer } from 'react';
import {
  createSessionFromDraft,
  initialRunningSessionState,
  runningSessionReducer,
} from '../../domain/runningSession.ts';
import type {
  RunningSessionState,
  SessionDraft,
  TimeTrackerSession,
} from '../../domain/types.ts';
import { useRunningSessionTimer } from './useRunningSessionTimer.ts';

type NowFn = () => number;

export type UseRunningSessionStateOptions = {
  now?: NowFn;
  tickIntervalMs?: number;
  initialState?: RunningSessionState;
};

export type RunningSessionStateApi = {
  state: RunningSessionState;
  start: (title: string, project?: string | null) => boolean;
  stop: () => TimeTrackerSession | null;
  updateDraft: (partial: Partial<Omit<SessionDraft, 'startedAt'>>) => void;
  adjustDuration: (deltaSeconds: number) => void;
  reset: () => void;
  hydrate: (nextState: RunningSessionState | null) => void;
};

const defaultNow = () => Date.now();

export const useRunningSessionState = (
  options: UseRunningSessionStateOptions = {},
): RunningSessionStateApi => {
  const { now = defaultNow, tickIntervalMs, initialState } = options;

  const reducerInitialState = useMemo<RunningSessionState>(() => {
    if (initialState) return initialState;
    return initialRunningSessionState;
  }, [initialState]);

  const [state, dispatch] = useReducer(
    runningSessionReducer,
    reducerInitialState,
  );

  useRunningSessionTimer({ state, dispatch, now, tickIntervalMs });

  const start = useCallback(
    (rawTitle: string, project?: string | null) => {
      const title = rawTitle.trim();
      if (!title) return false;
      if (state.status === 'running') return false;

      dispatch({
        type: 'START',
        payload: { title, startedAt: now(), project },
      });
      return true;
    },
    [now, state.status],
  );

  const stop = useCallback((): TimeTrackerSession | null => {
    if (state.status !== 'running') return null;
    const stoppedAt = now();
    const session = createSessionFromDraft(state.draft, stoppedAt);
    dispatch({ type: 'RESET' });
    return session;
  }, [now, state]);

  const updateDraft = useCallback(
    (partial: Partial<Omit<SessionDraft, 'startedAt'>>) => {
      if (state.status !== 'running') return;
      dispatch({ type: 'UPDATE_DRAFT', payload: partial });
    },
    [state.status],
  );

  const adjustDuration = useCallback(
    (deltaSeconds: number) => {
      if (state.status !== 'running') return;
      if (deltaSeconds === 0) return;
      dispatch({
        type: 'ADJUST_DURATION',
        payload: { deltaSeconds, nowMs: now() },
      });
    },
    [now, state.status],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const hydrate = useCallback((nextState: RunningSessionState | null) => {
    if (!nextState) {
      dispatch({ type: 'RESET' });
      return;
    }
    dispatch({ type: 'RESTORE', payload: nextState });
  }, []);

  return {
    state,
    start,
    stop,
    updateDraft,
    adjustDuration,
    reset,
    hydrate,
  };
};
