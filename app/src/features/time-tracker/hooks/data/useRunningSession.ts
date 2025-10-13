import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { createTimeTrackerDataSource } from '../../../../infra/repository/TimeTracker';
import type {
  RunningSessionState,
  SessionDraft,
  TimeTrackerSession,
} from '../../domain/types.ts';
import type { TimeTrackerDataSource } from '../../../../infra/repository/TimeTracker';
import {
  initialRunningSessionState,
  runningSessionReducer,
} from '../../domain/runningSession.ts';

type NowFn = () => number;

export type UseRunningSessionOptions = {
  now?: NowFn;
  tickIntervalMs?: number;
  initialState?: RunningSessionState;
  userId?: string | null;
};

export type RunningSessionApi = {
  state: RunningSessionState;
  start: (title: string) => boolean;
  stop: () => TimeTrackerSession | null;
  updateDraft: (partial: Partial<Omit<SessionDraft, 'startedAt'>>) => void;
  adjustDuration: (deltaSeconds: number) => void;
  reset: () => void;
};


const defaultNow = () => Date.now();
const createSignature = (state: RunningSessionState): string => {
  if (state.status !== 'running') return 'idle';
  const draft = state.draft;
  return `running:${draft.title ?? ''}|${draft.project ?? ''}|${draft.startedAt}`;
};

// Draft → Session
export const createSessionFromDraft = (
  draft: SessionDraft,
  stoppedAtMs: number,
): TimeTrackerSession => {
  const durationSeconds = Math.max(
    1,
    Math.floor((stoppedAtMs - draft.startedAt) / 1000),
  );

  const session: TimeTrackerSession = {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(stoppedAtMs),
    title: draft.title.trim(),
    startedAt: draft.startedAt,
    endedAt: stoppedAtMs,
    durationSeconds,
  };

  if (draft.tags?.length) session.tags = draft.tags.slice();
  if (draft.project) session.project = draft.project;
  if (draft.skill) session.skill = draft.skill;
  if (draft.intensity) session.intensity = draft.intensity;
  if (draft.notes) session.notes = draft.notes;

  return session;
};

export const useRunningSession = (
  options: UseRunningSessionOptions = {},
): RunningSessionApi & { mode: TimeTrackerDataSource['mode'] } => {
  const { now = defaultNow, tickIntervalMs, initialState, userId = null } =
    options;

  const dataSource = useMemo<TimeTrackerDataSource>(
    () => createTimeTrackerDataSource({ now, userId }),
    [now, userId],
  );

  const initialRunningState = dataSource.initialRunningState;

  const reducerInitialState = useMemo<RunningSessionState>(() => {
    if (initialState) return initialState;
    return initialRunningState ?? initialRunningSessionState;
  }, [initialState, initialRunningState]);

  const [state, dispatch] = useReducer(
    runningSessionReducer,
    reducerInitialState,
  );

  const signatureRef = useRef<string | null>(null);
  const latestStateRef = useRef<RunningSessionState>(reducerInitialState);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  const runningStartedAt =
    state.status === 'running' ? state.draft.startedAt : null;

  useEffect(() => {
    if (state.status !== 'running') {
      return;
    }
    const intervalMs = Math.max(100, tickIntervalMs ?? 1000);
    const tick = () => {
      dispatch({ type: 'TICK', payload: { nowMs: now() } });
    };

    tick();
    const timerId = setInterval(tick, intervalMs);
    return () => {
      clearInterval(timerId);
    };
  }, [state.status, runningStartedAt, tickIntervalMs, now]);

  useEffect(() => {
    if (dataSource.mode === 'supabase' && !userId) {
      dispatch({ type: 'RESET' });
      signatureRef.current = null;
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const remoteState = await dataSource.fetchRunningState();
        if (cancelled || !remoteState) return;
        const currentSignature = createSignature(latestStateRef.current);
        const remoteSignature = createSignature(remoteState);
        signatureRef.current = remoteSignature;
        if (currentSignature === remoteSignature) {
          return;
        }
        dispatch({ type: 'RESTORE', payload: remoteState });
      } catch (error) {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.warn('[time-tracker] Failed to load running state', error);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [dataSource, userId]);

  const persistState = useCallback((stateToPersist: RunningSessionState) => {
    if (dataSource.mode === 'supabase' && !userId) {
      return;
    }
    void dataSource.persistRunningState(stateToPersist).catch((error) => {
      if (import.meta.env.MODE !== 'test') {
        // eslint-disable-next-line no-console
        console.warn('[time-tracker] Failed to persist running state', error);
      }
    });
  }, [dataSource, userId]);

  useEffect(() => {
    const signature = createSignature(state);
    if (signatureRef.current === signature) {
      return;
    }
    signatureRef.current = signature;

    if (state.status === 'running') {
      persistState(state);
    } else {
      persistState({ status: 'idle', draft: null, elapsedSeconds: 0 });
    }
  }, [state, persistState]);

  const start = useCallback(
    (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return false;
      if (state.status === 'running') return false;

      dispatch({
        type: 'START',
        payload: { title: trimmed, startedAt: now() },
      });
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
        payload: { deltaSeconds, nowMs: now() },
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
    mode: dataSource.mode,
  };
};
