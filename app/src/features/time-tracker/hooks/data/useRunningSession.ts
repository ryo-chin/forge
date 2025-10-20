import { useMemo } from 'react';
import {
  createTimeTrackerDataSource,
  type TimeTrackerDataSource,
} from '../../../../infra/repository/TimeTracker';
import type { RunningSessionState } from '../../domain/types.ts';
import {
  useRunningSessionState,
  type RunningSessionStateApi,
} from './useRunningSessionState.ts';
import {
  useRunningSessionSync,
  type UseRunningSessionSyncResult,
} from './useRunningSessionSync.ts';

type NowFn = () => number;

export type UseRunningSessionOptions = {
  now?: NowFn;
  tickIntervalMs?: number;
  initialState?: RunningSessionState;
  userId?: string | null;
};

export type RunningSessionApi = {
  state: RunningSessionState;
  start: RunningSessionStateApi['start'];
  stop: RunningSessionStateApi['stop'];
  updateDraft: RunningSessionStateApi['updateDraft'];
  adjustDuration: RunningSessionStateApi['adjustDuration'];
  reset: RunningSessionStateApi['reset'];
  persistRunningState: UseRunningSessionSyncResult['persistNow'];
};

const defaultNow = () => Date.now();

export const useRunningSession = (
  options: UseRunningSessionOptions = {},
): RunningSessionApi & { mode: TimeTrackerDataSource['mode'] } => {
  const { now = defaultNow, tickIntervalMs, initialState, userId = null } =
    options;

  const dataSource = useMemo<TimeTrackerDataSource>(
    () => createTimeTrackerDataSource({ now, userId }),
    [now, userId],
  );

  const resolvedInitialState =
    initialState ?? dataSource.initialRunningState ?? undefined;

  const {
    state,
    start,
    stop,
    updateDraft,
    adjustDuration,
    reset,
    hydrate,
  } = useRunningSessionState({
    now,
    tickIntervalMs,
    initialState: resolvedInitialState,
  });

  const { persistNow } = useRunningSessionSync({
    dataSource,
    state,
    hydrate,
    userId,
  });

  return {
    state,
    start,
    stop,
    updateDraft,
    adjustDuration,
    reset,
    persistRunningState: persistNow,
    mode: dataSource.mode,
  };
};
