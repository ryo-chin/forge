import { useEffect } from 'react';
import type { RunningSessionAction } from '../../domain/runningSession.ts';
import type { RunningSessionState } from '../../domain/types.ts';

type RunningSessionTimerOptions = {
  state: RunningSessionState;
  dispatch: React.Dispatch<RunningSessionAction>;
  now: () => number;
  tickIntervalMs?: number;
};

const MIN_INTERVAL_MS = 100;

export const useRunningSessionTimer = ({
  state,
  dispatch,
  now,
  tickIntervalMs,
}: RunningSessionTimerOptions): void => {
  const runningStartedAt =
    state.status === 'running' ? state.draft.startedAt : null;

  useEffect(() => {
    if (state.status !== 'running') {
      return;
    }

    const intervalMs = Math.max(MIN_INTERVAL_MS, tickIntervalMs ?? 1000);
    const tick = () => {
      dispatch({ type: 'TICK', payload: { nowMs: now() } });
    };

    tick();
    const timerId = setInterval(tick, intervalMs);
    return () => {
      clearInterval(timerId);
    };
  }, [state.status, runningStartedAt, tickIntervalMs, now, dispatch]);
};
