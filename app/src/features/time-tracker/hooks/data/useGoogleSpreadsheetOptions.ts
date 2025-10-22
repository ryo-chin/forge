import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSettings,
  updateSettings,
  listSpreadsheets,
  listSheets,
  startOAuth,
  isGoogleSyncClientEnabled,
} from '@infra/google';
import type {
  UpdateGoogleSettingsPayload,
  OAuthStartResponse,
} from '@infra/google';
import type {
  GoogleSyncSettings,
  SheetOption,
  SpreadsheetOption,
} from '../../domain/googleSyncTypes.ts';
import { getSupabaseClient } from '@infra/supabase';
import { useAuth } from '@infra/auth';

type GoogleSheetsOptions = {
  spreadsheetId: string;
  sheetName: string;
  mappings: Record<string, string>;
};

type UpdateSelectionPayload = UpdateGoogleSettingsPayload;

type FetchSpreadsheetsResult = { items: SpreadsheetOption[]; nextPageToken?: string };
type FetchSheetsResult = { items: SheetOption[] };

const SETTINGS_QUERY_KEY = ['google-sync', 'settings'] as const;
const LOCAL_STORAGE_KEY = 'google-sheets-sync-config';

const persistSheetsConfig = (settings: GoogleSyncSettings | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (
      !settings?.spreadsheet?.id ||
      !settings.spreadsheet.sheetTitle ||
      !settings.columnMapping?.mappings
    ) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return;
    }

    const config: GoogleSheetsOptions = {
      spreadsheetId: settings.spreadsheet.id,
      sheetName: settings.spreadsheet.sheetTitle,
      mappings: settings.columnMapping.mappings,
    };

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    if (import.meta.env.MODE !== 'test') {
      // eslint-disable-next-line no-console
      console.warn('[google-sync] Failed to persist sheets config', error);
    }
  }
};

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
      persistSheetsConfig(data);
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

  useEffect(() => {
    persistSheetsConfig(settingsQuery.data ?? null);
  }, [settingsQuery.data]);

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
