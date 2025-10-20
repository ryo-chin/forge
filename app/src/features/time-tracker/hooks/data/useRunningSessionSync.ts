import { useEffect, useRef } from 'react';
import { initialRunningSessionState } from '../../domain/runningSession.ts';
import type { RunningSessionState } from '../../domain/types.ts';
import type { TimeTrackerDataSource } from '../../../../infra/repository/TimeTracker';

type UseRunningSessionSyncOptions = {
  dataSource: TimeTrackerDataSource;
  state: RunningSessionState;
  hydrate: (nextState: RunningSessionState | null) => void;
  userId: string | null;
};

const serializeState = (state: RunningSessionState): string => {
  if (state.status !== 'running') {
    return JSON.stringify({ status: 'idle' });
  }
  const { draft, elapsedSeconds } = state;
  return JSON.stringify({
    status: 'running',
    elapsedSeconds,
    draft: {
      id: draft.id,
      title: draft.title ?? '',
      startedAt: draft.startedAt,
      tags: Array.isArray(draft.tags) ? draft.tags : [],
      project: draft.project ?? null,
      skill: draft.skill ?? null,
      intensity: draft.intensity ?? null,
      notes: draft.notes ?? null,
    },
  });
};

const shouldLogWarnings = import.meta.env.MODE !== 'test';

export const useRunningSessionSync = ({
  dataSource,
  state,
  hydrate,
  userId,
}: UseRunningSessionSyncOptions): void => {
  const isSupabaseMode = dataSource.mode === 'supabase';
  const syncEnabled = isSupabaseMode ? Boolean(userId) : true;

  const latestStateRef = useRef(state);
  const persistSignatureRef = useRef<string>(serializeState(state));
  const readyRef = useRef<boolean>(!isSupabaseMode);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!syncEnabled) {
      hydrate(null);
      persistSignatureRef.current = serializeState(initialRunningSessionState);
      readyRef.current = !isSupabaseMode;
      return;
    }

    if (isSupabaseMode) {
      readyRef.current = false;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const remoteState = await dataSource.fetchRunningState();
        if (cancelled) return;

        const currentState = latestStateRef.current;
        const currentSignature = serializeState(currentState);
        const persistedSignature = persistSignatureRef.current;

        const nextState = remoteState ?? initialRunningSessionState;
        const nextSignature = serializeState(nextState);

        const hasLocalChanges = currentSignature !== persistedSignature;

        if (!hasLocalChanges) {
          if (currentSignature !== nextSignature) {
            hydrate(remoteState ?? null);
          }
          persistSignatureRef.current = nextSignature;
        } else {
          // ロード中にローカル更新された場合はローカルを優先し、すぐに永続化する
          const targetState =
            currentState.status === 'running'
              ? currentState
              : initialRunningSessionState;
          persistSignatureRef.current = serializeState(targetState);
          void dataSource.persistRunningState(targetState).catch((error) => {
            if (!shouldLogWarnings) {
              return;
            }
            // eslint-disable-next-line no-console
            console.warn('[time-tracker] Failed to persist running state', error);
          });
        }

        readyRef.current = true;
      } catch (error) {
        if (shouldLogWarnings) {
          // eslint-disable-next-line no-console
          console.warn('[time-tracker] Failed to load running state', error);
        }
        readyRef.current = true;
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [syncEnabled, dataSource, hydrate, isSupabaseMode]);

  useEffect(() => {
    if (!syncEnabled) return;
    if (isSupabaseMode && !readyRef.current) return;

    const targetState =
      state.status === 'running' ? state : initialRunningSessionState;
    const signature = serializeState(targetState);
    if (persistSignatureRef.current === signature) {
      return;
    }
    persistSignatureRef.current = signature;

    void dataSource.persistRunningState(targetState).catch((error: unknown) => {
      if (!shouldLogWarnings) {
        return;
      }
      // eslint-disable-next-line no-console
      console.warn('[time-tracker] Failed to persist running state', error);
    });
  }, [syncEnabled, state, dataSource, isSupabaseMode]);
};
