/**
 * Google Sheets Repository
 *
 * features/からGoogle Sheets APIにアクセスするための抽象化レイヤー。
 * 内部でinfra/google/googleSyncClientを使用する。
 */

import {
  appendRunningSession as appendRunningSessionClient,
  clearRunningSession as clearRunningSessionClient,
  deleteSessionRow as deleteSessionRowClient,
  GoogleSyncClientError,
  syncSession as syncSessionClient,
  updateRunningSession as updateRunningSessionClient,
  fetchSettings as fetchSettingsClient,
  updateSettings as updateSettingsClient,
  listSpreadsheets as listSpreadsheetsClient,
  listSheets as listSheetsClient,
  startOAuth as startOAuthClient,
  revokeOAuth as revokeOAuthClient,
  retrySync as retrySyncClient,
  type OAuthStartResponse,
  type UpdateGoogleSettingsPayload,
  type SyncRetryResponse,
} from '../../google/googleSyncClient.ts';

import type {
  GoogleSyncLog,
  GoogleSyncRequestBody,
  GoogleSyncSettings,
  SheetOption,
  SpreadsheetOption,
} from '../../../features/time-tracker/domain/googleSyncTypes.ts';

// Re-export types and error class for features/ to use
export { GoogleSyncClientError };
export type { OAuthStartResponse, UpdateGoogleSettingsPayload, SyncRetryResponse };

type RunningSessionDraftPayload = {
  id: string;
  title: string;
  startedAt: string;
  project?: string | null;
  tags?: string[];
  skill?: string | null;
  intensity?: string | null;
  notes?: string | null;
};

// Sync operations
export const syncSession = (
  token: string,
  payload: GoogleSyncRequestBody,
): Promise<GoogleSyncLog> => syncSessionClient(token, payload);

export const retrySync = (token: string, sessionId: string): Promise<SyncRetryResponse> =>
  retrySyncClient(token, sessionId);

export const deleteSessionRow = (token: string, sessionId: string): Promise<{ status: string }> =>
  deleteSessionRowClient(token, sessionId);

// Running session operations
export const appendRunningSession = (
  token: string,
  draft: RunningSessionDraftPayload,
): Promise<{ status: string }> => appendRunningSessionClient(token, draft);

export const updateRunningSession = (
  token: string,
  payload: { draft: RunningSessionDraftPayload; elapsedSeconds: number },
): Promise<{ status: string }> => updateRunningSessionClient(token, payload);

export const clearRunningSession = (
  token: string,
  sessionId: string,
): Promise<{ status: string }> => clearRunningSessionClient(token, sessionId);

// Settings operations
export const fetchSettings = (token: string): Promise<GoogleSyncSettings> =>
  fetchSettingsClient(token);

export const updateSettings = (
  token: string,
  payload: UpdateGoogleSettingsPayload,
): Promise<GoogleSyncSettings> => updateSettingsClient(token, payload);

// Spreadsheet/Sheet listing
export const listSpreadsheets = (
  token: string,
  query?: string,
): Promise<{ items: SpreadsheetOption[]; nextPageToken?: string }> =>
  listSpreadsheetsClient(token, query);

export const listSheets = (
  token: string,
  spreadsheetId: string,
): Promise<{ items: SheetOption[] }> => listSheetsClient(token, spreadsheetId);

// OAuth operations
export const startOAuth = (token: string, redirectPath: string): Promise<OAuthStartResponse> =>
  startOAuthClient(token, redirectPath);

export const revokeOAuth = (token: string): Promise<void> => revokeOAuthClient(token);
