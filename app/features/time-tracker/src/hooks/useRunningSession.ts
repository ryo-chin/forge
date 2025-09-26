import { useCallback, useEffect, useReducer } from 'react';
import {
  createSessionFromDraft,
  initialRunningSessionState,
  runningSessionReducer,
} from '../domain/runningSession';
import type { RunningSessionState, SessionDraft, TimeTrackerSession } from '../types';

type NowFn = () => number;

export type UseRunningSessionOptions = {
  now?: NowFn;
  tickIntervalMs?: number;
  initialState?: RunningSessionState;
};

export type RunningSessionApi = {
  state: RunningSessionState;
  start: (title: string) => boolean;
  stop: () => TimeTrackerSession | null;
  updateDraft: (partial: Partial<Omit<SessionDraft, 'startedAt'>>) => void;
  adjustDuration: (deltaSeconds: number) => void;
  reset: () => void;
};

const defaultNow: NowFn = () => Date.now();
const DEFAULT_INTERVAL = 1000;

export const useRunningSession = (
  options: UseRunningSessionOptions = {},
): RunningSessionApi => {
  const {
    now = defaultNow,
    tickIntervalMs = DEFAULT_INTERVAL,
    initialState,
  } = options;

  const [state, dispatch] = useReducer(
    runningSessionReducer,
    initialState ?? initialRunningSessionState,
  );

  useEffect(() => {
    if (state.status !== 'running') {
      return;
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: 'TICK', payload: { now: now() } });
    }, tickIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [state.status, tickIntervalMs, now]);

  const start = useCallback(
    (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return false;
      if (state.status === 'running') return false;

      dispatch({ type: 'START', payload: { title: trimmed, startedAt: now() } });
      return true;
    },
    [now, state.status],
  );

  const stop = useCallback(() => {
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
        payload: { deltaSeconds, now: now() },
      });
    },
    [now, state.status],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    start,
    stop,
    updateDraft,
    adjustDuration,
    reset,
  };
};
