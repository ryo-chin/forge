import { getAccessToken, useAuth } from '@infra/auth';
import { getGoogleSyncApiBaseUrl, isGoogleSyncEnabled } from '@infra/config';
import {
  appendRunningSession as appendRunningSessionRequest,
  clearRunningSession as clearRunningSessionRequest,
  deleteSessionRow as deleteSessionRowRequest,
  syncSession as syncSessionRequest,
  updateRunningSession as updateRunningSessionRequest,
} from '@infra/repository/GoogleSheets';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { GoogleSyncRequestBody } from '../../domain/googleSyncTypes.ts';
import type { SessionDraft, TimeTrackerSession } from '../../domain/types.ts';

export type SyncStateStatus = 'idle' | 'syncing' | 'success' | 'error' | 'disabled';

export type SyncState = {
  status: SyncStateStatus;
  lastSessionId: string | null;
  lastSyncedAt: string | null;
  error: string | null;
};

const initialState: SyncState = {
  status: 'idle',
  lastSessionId: null,
  lastSyncedAt: null,
  error: null,
};

const toRequestBody = (session: TimeTrackerSession): GoogleSyncRequestBody => ({
  session: {
    id: session.id,
    title: session.title,
    startedAt: new Date(session.startedAt).toISOString(),
    endedAt: new Date(session.endedAt).toISOString(),
    durationSeconds: session.durationSeconds,
    project: session.project ?? null,
    notes: session.notes ?? null,
    tags: session.tags ?? [],
    skill: session.skill ?? null,
    intensity: session.intensity ?? null,
  },
  source: 'time-tracker-app',
});

/**
 * LocalStorageからGoogle Sheets設定を読み込む
 */
const hasGoogleSheetsConfig = (): boolean => {
  try {
    const stored = localStorage.getItem('google-sheets-sync-config');
    return typeof stored === 'string' && stored.length > 0;
  } catch {
    return false;
  }
};

export const useGoogleSpreadsheetSync = () => {
  const { status: authStatus } = useAuth();
  const [state, setState] = useState<SyncState>(initialState);
  const updateDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const canSync = useMemo(() => {
    if (!isGoogleSyncEnabled()) {
      return false;
    }
    if (!getGoogleSyncApiBaseUrl()) {
      return false;
    }
    return authStatus === 'authenticated';
  }, [authStatus]);

  const mutation = useMutation({
    mutationFn: async (session: TimeTrackerSession) => {
      const accessToken = await getAccessToken();
      const response = await syncSessionRequest(accessToken, toRequestBody(session));
      return {
        response,
        sessionId: session.id,
      };
    },
    onMutate: async (session) => {
      setState((prev) => ({
        ...prev,
        status: 'syncing',
        lastSessionId: session.id,
        error: null,
      }));
    },
    onSuccess: ({ response, sessionId }) => {
      setState({
        status: 'success',
        lastSessionId: sessionId,
        lastSyncedAt: new Date().toISOString(),
        error: null,
      });
      return response;
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : '同期に失敗しました';
      setState((prev) => ({
        ...prev,
        status: 'error',
        lastSyncedAt: new Date().toISOString(),
        error: message,
      }));
    },
  });

  const syncSession = useCallback(
    async (session: TimeTrackerSession) => {
      if (!canSync) {
        setState((prev) => ({
          ...prev,
          status: 'disabled',
          error: null,
        }));
        return null;
      }
      try {
        const result = await mutation.mutateAsync(session);
        return result.response;
      } catch {
        return null;
      }
    },
    [canSync, mutation],
  );

  /**
   * Running Session開始時の同期
   */
  const syncRunningSessionStart = useCallback(
    async (draft: SessionDraft) => {
      if (!canSync) {
        return null;
      }
      if (!hasGoogleSheetsConfig()) {
        return null;
      }
      try {
        const accessToken = await getAccessToken();
        await appendRunningSessionRequest(accessToken, {
          id: draft.id,
          title: draft.title,
          startedAt: new Date(draft.startedAt).toISOString(),
          project: draft.project ?? null,
          tags: draft.tags ?? [],
          skill: draft.skill ?? null,
          intensity: draft.intensity ?? null,
          notes: draft.notes ?? null,
        });
        return { success: true };
      } catch (error) {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.warn('[Google Sheets] Failed to append running session', error);
        }
        return null;
      }
    },
    [canSync],
  );

  /**
   * Running Session更新時の同期（debounce適用）
   */
  const syncRunningSessionUpdate = useCallback(
    async (draft: SessionDraft, elapsedSeconds: number) => {
      if (!canSync) {
        return null;
      }
      if (!hasGoogleSheetsConfig()) {
        return null;
      }

      if (updateDebounceTimerRef.current) {
        clearTimeout(updateDebounceTimerRef.current);
      }

      return new Promise<{ success: boolean } | null>((resolve) => {
        updateDebounceTimerRef.current = setTimeout(async () => {
          try {
            const accessToken = await getAccessToken();
            await updateRunningSessionRequest(accessToken, {
              draft: {
                id: draft.id,
                title: draft.title,
                startedAt: new Date(draft.startedAt).toISOString(),
                project: draft.project ?? null,
                tags: draft.tags ?? [],
                skill: draft.skill ?? null,
                intensity: draft.intensity ?? null,
                notes: draft.notes ?? null,
              },
              elapsedSeconds,
            });
            resolve({ success: true });
          } catch (error) {
            if (import.meta.env.MODE !== 'test') {
              // eslint-disable-next-line no-console
              console.warn('[Google Sheets] Failed to update running session', error);
            }
            resolve(null);
          }
        }, 1000);
      });
    },
    [canSync],
  );

  const syncRunningSessionCancel = useCallback(
    async (sessionId: string) => {
      if (!canSync) {
        return null;
      }
      if (!hasGoogleSheetsConfig()) {
        return null;
      }
      if (!sessionId) {
        return null;
      }

      try {
        const accessToken = await getAccessToken();
        await clearRunningSessionRequest(accessToken, sessionId);
        return { success: true };
      } catch (error) {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.warn('[Google Sheets] Failed to clear running session', error);
        }
        return null;
      }
    },
    [canSync],
  );

  const deleteSessionRow = useCallback(
    async (sessionId: string) => {
      if (!canSync) {
        return null;
      }
      if (!hasGoogleSheetsConfig()) {
        return null;
      }
      if (!sessionId) {
        return null;
      }

      try {
        const accessToken = await getAccessToken();
        await deleteSessionRowRequest(accessToken, sessionId);
        return { success: true };
      } catch (error) {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.warn('[Google Sheets] Failed to delete session row', error);
        }
        return null;
      }
    },
    [canSync],
  );

  return {
    state,
    syncSession,
    syncRunningSessionStart,
    syncRunningSessionUpdate,
    syncRunningSessionCancel,
    deleteSessionRow,
  };
};
