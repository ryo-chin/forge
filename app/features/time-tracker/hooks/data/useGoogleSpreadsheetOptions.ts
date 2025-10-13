import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSettings,
  updateSettings,
  listSpreadsheets,
  listSheets,
  startOAuth,
  isGoogleSyncClientEnabled,
} from '@infra/google/googleSyncClient.ts';
import type {
  UpdateGoogleSettingsPayload,
  OAuthStartResponse,
} from '@infra/google/googleSyncClient.ts';
import type {
  GoogleSyncSettings,
  SheetOption,
  SpreadsheetOption,
} from '@features/time-tracker/domain/googleSyncTypes.ts';
import { getSupabaseClient } from '@infra/supabase/client.ts';
import { useAuth } from '@infra/auth';

type UpdateSelectionPayload = UpdateGoogleSettingsPayload;

type FetchSpreadsheetsResult = { items: SpreadsheetOption[]; nextPageToken?: string };
type FetchSheetsResult = { items: SheetOption[] };

const SETTINGS_QUERY_KEY = ['google-sync', 'settings'] as const;

const getAccessToken = async (): Promise<string> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  const token = data?.session?.access_token;
  if (!token) {
    throw new Error('Supabase access token is not available');
  }
  return token;
};

export const useGoogleSpreadsheetOptions = () => {
  const { status: authStatus } = useAuth();
  const queryClient = useQueryClient();

  const isEnabled = useMemo(
    () => isGoogleSyncClientEnabled() && authStatus === 'authenticated',
    [authStatus],
  );

  const settingsQuery = useQuery<GoogleSyncSettings>({
    queryKey: SETTINGS_QUERY_KEY,
    enabled: isEnabled,
    queryFn: async () => {
      const token = await getAccessToken();
      return fetchSettings(token);
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: UpdateSelectionPayload) => {
      const token = await getAccessToken();
      return updateSettings(token, payload);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, data);
    },
  });

  const updateSelection = useCallback(
    async (payload: UpdateSelectionPayload) =>
      updateSettingsMutation.mutateAsync(payload),
    [updateSettingsMutation],
  );

  const fetchSpreadsheetsFn = useCallback(
    async (query?: string): Promise<FetchSpreadsheetsResult> => {
      const token = await getAccessToken();
      return listSpreadsheets(token, query);
    },
    [],
  );

  const fetchSheetsFn = useCallback(
    async (spreadsheetId: string): Promise<FetchSheetsResult> => {
      const token = await getAccessToken();
      return listSheets(token, spreadsheetId);
    },
    [],
  );

  const startOAuthFlow = useCallback(
    async (redirectPath: string): Promise<OAuthStartResponse> => {
      const token = await getAccessToken();
      return startOAuth(token, redirectPath);
    },
    [],
  );

  return {
    settings: settingsQuery,
    updateSelection,
    isUpdating: updateSettingsMutation.isPending,
    fetchSpreadsheets: fetchSpreadsheetsFn,
    fetchSheets: fetchSheetsFn,
    startOAuth: startOAuthFlow,
    refetchSettings: settingsQuery.refetch,
  };
};
