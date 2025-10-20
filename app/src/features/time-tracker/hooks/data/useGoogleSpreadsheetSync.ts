import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@infra/auth';
import {
  getGoogleSyncBaseUrl,
  isGoogleSyncClientEnabled,
  syncSession as syncSessionRequest,
} from '@infra/google';
import {
  appendRunningSession,
  updateRunningSession,
  completeRunningSession,
  type GoogleSheetsOptions,
} from '@infra/google/googleSheetsRunningSync';
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
const loadGoogleSheetsConfig = (): GoogleSheetsOptions | null => {
  try {
    const stored = localStorage.getItem('google-sheets-sync-config');
    if (!stored) return null;
    const config = JSON.parse(stored) as GoogleSheetsOptions;
    if (!config.spreadsheetId || !config.sheetName) return null;
    return config;
  } catch {
    return null;
  }
};

export const useGoogleSpreadsheetSync = () => {
  const { status: authStatus } = useAuth();
  const [state, setState] = useState<SyncState>(initialState);
  const updateDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }
      const accessToken = data?.session?.access_token;
      if (!accessToken) {
        throw new Error('Supabase access token is not available');
      }
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
      const config = loadGoogleSheetsConfig();
      if (!config) {
        return null;
      }
      try {
        await appendRunningSession(draft, config);
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
    async (draft: SessionDraft) => {
      if (!canSync) {
        return null;
      }
      const config = loadGoogleSheetsConfig();
      if (!config) {
        return null;
      }

      // 既存のdebounceタイマーをクリア
      if (updateDebounceTimerRef.current) {
        clearTimeout(updateDebounceTimerRef.current);
      }

      // 1秒後に更新を実行
      return new Promise<{ success: boolean } | null>((resolve) => {
        updateDebounceTimerRef.current = setTimeout(async () => {
          try {
            await updateRunningSession(draft, config);
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

  /**
   * Running Session完了時の同期
   */
  const syncRunningSessionComplete = useCallback(
    async (session: TimeTrackerSession) => {
      if (!canSync) {
        return null;
      }
      const config = loadGoogleSheetsConfig();
      if (!config) {
        return null;
      }
      try {
        await completeRunningSession(session, config);
        return { success: true };
      } catch (error) {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.warn('[Google Sheets] Failed to complete running session', error);
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
    syncRunningSessionComplete,
  };
};
