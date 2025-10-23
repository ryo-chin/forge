import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@infra/auth';
import {
  getGoogleSyncBaseUrl,
  isGoogleSyncClientEnabled,
  syncSession as syncSessionRequest,
  appendRunningSession as appendRunningSessionRequest,
  updateRunningSession as updateRunningSessionRequest,
  clearRunningSession as clearRunningSessionRequest,
  deleteSessionRow as deleteSessionRowRequest,
} from '@infra/google';
import { getSupabaseClient } from '@infra/supabase';
import type { SessionDraft, TimeTrackerSession } from '../../domain/types.ts';
import type { GoogleSyncRequestBody } from '../../domain/googleSyncTypes.ts';

export type SyncStateStatus =
  | 'idle'
  | 'syncing'
  | 'success'
  | 'error'
  | 'disabled';

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

const toRequestBody = (
  session: TimeTrackerSession,
): GoogleSyncRequestBody => ({
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

  const resolveAccessToken = useCallback(async (): Promise<string> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    const accessToken = data?.session?.access_token;
    if (!accessToken) {
      throw new Error('Supabase access token is not available');
    }
    return accessToken;
  }, []);

  const canSync = useMemo(() => {
    if (!isGoogleSyncClientEnabled()) {
      return false;
    }
    if (!getGoogleSyncBaseUrl()) {
      return false;
    }
    return authStatus === 'authenticated';
  }, [authStatus]);

  const mutation = useMutation({
    mutationFn: async (session: TimeTrackerSession) => {
      const accessToken = await resolveAccessToken();
      const response = await syncSessionRequest(
        accessToken,
        toRequestBody(session),
      );
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
      const message =
        error instanceof Error ? error.message : '同期に失敗しました';
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
        const accessToken = await resolveAccessToken();
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
    [canSync, resolveAccessToken],
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
            const accessToken = await resolveAccessToken();
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
    [canSync, resolveAccessToken],
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
        const accessToken = await resolveAccessToken();
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
    [canSync, resolveAccessToken],
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
        const accessToken = await resolveAccessToken();
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
    [canSync, resolveAccessToken],
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
