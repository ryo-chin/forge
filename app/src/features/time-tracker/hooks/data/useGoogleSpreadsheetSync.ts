import { useCallback, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../../infra/auth';
import {
  getGoogleSyncBaseUrl,
  isGoogleSyncClientEnabled,
  syncSession as syncSessionRequest,
} from '../../../../infra/google/googleSyncClient.ts';
import { getSupabaseClient } from '../../../../infra/supabase/client.ts';
import type { TimeTrackerSession } from '../../domain/types.ts';
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

export const useGoogleSpreadsheetSync = () => {
  const { status: authStatus } = useAuth();
  const [state, setState] = useState<SyncState>(initialState);

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

  return {
    state,
    syncSession,
  };
};
