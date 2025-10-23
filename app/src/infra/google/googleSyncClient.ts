import {
  buildGoogleSyncUrl,
  getGoogleSyncApiBaseUrl,
  isGoogleSyncEnabled,
} from '@infra/config';
import type {
  ColumnMappingConfig,
  GoogleSyncLog,
  GoogleSyncRequestBody,
  GoogleSyncSettings,
  SheetOption,
  SpreadsheetOption,
} from '../../features/time-tracker/domain/googleSyncTypes.ts';

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

export type UpdateGoogleSettingsPayload = {
  spreadsheetId: string;
  sheetId: number;
  sheetTitle: string;
  columnMapping?: ColumnMappingConfig['mappings'] | Record<string, string>;
};

export type OAuthStartResponse = {
  authorizationUrl: string;
};

export type SyncRetryResponse = GoogleSyncLog;

export class GoogleSyncClientError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'GoogleSyncClientError';
    this.status = status;
    this.detail = detail;
  }
}

const buildHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const request = async <T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  if (!isGoogleSyncEnabled()) {
    throw new GoogleSyncClientError('Google sync is disabled', 503);
  }

  const base = getGoogleSyncApiBaseUrl();
  if (!base) {
    throw new GoogleSyncClientError(
      'Google sync API base URL is not configured',
      500,
    );
  }

  const url = buildGoogleSyncUrl(path);
  const headers = {
    ...buildHeaders(token),
    ...(init.headers ?? {}),
  };

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    throw new GoogleSyncClientError(
      `Google sync request failed (${response.status}) ${JSON.stringify(
        detail,
      )}`,
      response.status,
      detail,
    );
  }

  if (
    response.headers.get('content-type')?.includes('application/json') ?? false
  ) {
    return (await response.json()) as T;
  }
  const text = await response.text();
  return text as unknown as T;
};

export const syncSession = (
  token: string,
  payload: GoogleSyncRequestBody,
): Promise<GoogleSyncLog> =>
  request(token, '/integrations/google/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const retrySync = (
  token: string,
  sessionId: string,
): Promise<SyncRetryResponse> =>
  request(token, `/integrations/google/sync/${sessionId}/retry`, {
    method: 'POST',
  });

export const fetchSettings = (
  token: string,
): Promise<GoogleSyncSettings> =>
  request(token, '/integrations/google/settings', {
    method: 'GET',
  });

export const updateSettings = (
  token: string,
  payload: UpdateGoogleSettingsPayload,
): Promise<GoogleSyncSettings> =>
  request(token, '/integrations/google/settings', {
    method: 'PUT',
    body: JSON.stringify({
      spreadsheetId: payload.spreadsheetId,
      sheetId: payload.sheetId,
      sheetTitle: payload.sheetTitle,
      columnMapping: payload.columnMapping ?? undefined,
    }),
  });

export const listSpreadsheets = (
  token: string,
  query?: string,
): Promise<{ items: SpreadsheetOption[]; nextPageToken?: string }> => {
  const params = new URLSearchParams();
  if (query && query.trim().length > 0) {
    params.set('q', query.trim());
  }
  const suffix = params.toString();
  const pathWithQuery = suffix.length
    ? `/integrations/google/spreadsheets?${suffix}`
    : '/integrations/google/spreadsheets';
  return request(token, pathWithQuery, { method: 'GET' });
};

export const listSheets = (
  token: string,
  spreadsheetId: string,
): Promise<{ items: SheetOption[] }> =>
  request(token, `/integrations/google/spreadsheets/${spreadsheetId}/sheets`, {
    method: 'GET',
  });

export const startOAuth = (
  token: string,
  redirectPath: string,
): Promise<OAuthStartResponse> =>
  request(token, '/integrations/google/oauth/start', {
    method: 'POST',
    body: JSON.stringify({ redirectPath }),
  });

export const revokeOAuth = (token: string): Promise<void> =>
  request(token, '/integrations/google/oauth/revoke', {
    method: 'POST',
  });

export const appendRunningSession = (
  token: string,
  draft: RunningSessionDraftPayload,
): Promise<{ status: string }> =>
  request(token, '/integrations/google/running/start', {
    method: 'POST',
    body: JSON.stringify({ draft }),
  });

export const updateRunningSession = (
  token: string,
  payload: { draft: RunningSessionDraftPayload; elapsedSeconds: number },
): Promise<{ status: string }> =>
  request(token, '/integrations/google/running/update', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const clearRunningSession = (
  token: string,
  sessionId: string,
): Promise<{ status: string }> =>
  request(token, '/integrations/google/running/cancel', {
    method: 'POST',
    body: JSON.stringify({ id: sessionId }),
  });

export const isGoogleSyncClientEnabled = (): boolean => isGoogleSyncEnabled();
export const getGoogleSyncBaseUrl = (): string | null => {
  return getGoogleSyncApiBaseUrl() || null;
};
