import type { Env } from '../env';

export type ConnectionStatus = 'active' | 'revoked' | 'error';

export type GoogleSpreadsheetConnectionRow = {
  id: string;
  user_id: string;
  google_user_id: string;
  spreadsheet_id: string | null;
  sheet_id: number | null;
  sheet_title: string | null;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  scopes: string[];
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
};

export type GoogleSpreadsheetColumnMappingRow = {
  id: string;
  connection_id: string;
  mappings: Record<string, unknown>;
  required_columns: string[];
  optional_columns: string[];
  created_at: string;
  updated_at: string;
};

export type GoogleSyncLogRow = {
  id: string;
  connection_id: string;
  session_id: string;
  status: 'pending' | 'success' | 'failed';
  attempted_at: string;
  failure_reason: string | null;
  google_append_request: Record<string, unknown> | null;
  google_append_response: Record<string, unknown> | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
};

export type UpsertConnectionPayload = {
  userId: string;
  googleUserId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  scopes?: string[];
  status?: ConnectionStatus;
};

export type UpdateSelectionPayload = {
  spreadsheetId: string;
  sheetId: number;
  sheetTitle?: string | null;
};

export type ColumnMappingPayload = {
  connectionId: string;
  mappings: Record<string, string>;
  requiredColumns?: string[];
  optionalColumns?: string[];
};

export type CreateSyncLogPayload = {
  connectionId: string;
  sessionId: string;
  googleAppendRequest?: Record<string, unknown> | null;
};

export type UpdateSyncLogPayload = {
  status: 'success' | 'failed';
  failureReason?: string | null;
  googleAppendResponse?: Record<string, unknown> | null;
  retryCount?: number;
};

export class SupabaseRepositoryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SupabaseRepositoryError';
    this.status = status;
  }
}

const REST_PREFIX = '/rest/v1';

const ensureConfig = (env: Env) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new SupabaseRepositoryError('Supabase REST configuration is missing', 500);
  }
};

const resolveRestUrl = (env: Env, path: string, searchParams?: Record<string, string>): URL => {
  const url = new URL(`${REST_PREFIX}/${path}`, env.SUPABASE_URL);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
};

const restHeaders = (env: Env, prefer?: string): HeadersInit => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  };
  if (prefer) {
    headers.Prefer = prefer;
  }
  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  const text = await response.text();
  return text as unknown as T;
};

const request = async <T>(
  env: Env,
  method: string,
  path: string,
  options: {
    searchParams?: Record<string, string>;
    body?: unknown;
    prefer?: string;
  } = {},
): Promise<T> => {
  ensureConfig(env);
  const url = resolveRestUrl(env, path, options.searchParams);
  const response = await fetch(url, {
    method,
    headers: restHeaders(env, options.prefer),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    throw new SupabaseRepositoryError(
      `Supabase request failed: ${method} ${url.toString()} (${response.status}) ${JSON.stringify(
        detail,
      )}`,
      response.status,
    );
  }

  return handleResponse<T>(response);
};

export const getConnectionByUser = async (
  env: Env,
  userId: string,
): Promise<GoogleSpreadsheetConnectionRow | null> => {
  const records = await request<GoogleSpreadsheetConnectionRow[]>(
    env,
    'GET',
    'google_spreadsheet_connections',
    {
      searchParams: {
        select: '*',
        user_id: `eq.${userId}`,
        limit: '1',
      },
    },
  );
  return records.length > 0 ? records[0] : null;
};

export const upsertConnection = async (
  env: Env,
  payload: UpsertConnectionPayload,
): Promise<GoogleSpreadsheetConnectionRow> => {
  const body = {
    user_id: payload.userId,
    google_user_id: payload.googleUserId,
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken,
    access_token_expires_at: payload.accessTokenExpiresAt,
    scopes: payload.scopes ?? ['https://www.googleapis.com/auth/spreadsheets'],
    status: payload.status ?? 'active',
    updated_at: new Date().toISOString(),
  };

  const rows = await request<GoogleSpreadsheetConnectionRow[]>(
    env,
    'POST',
    'google_spreadsheet_connections',
    {
      body,
      searchParams: { on_conflict: 'user_id', select: '*' },
      prefer: 'resolution=merge-duplicates,return=representation',
    },
  );

  return rows[0];
};

export const updateAccessToken = async (
  env: Env,
  connectionId: string,
  accessToken: string,
  expiresAt: string,
): Promise<void> => {
  await request(env, 'PATCH', 'google_spreadsheet_connections', {
    searchParams: { id: `eq.${connectionId}` },
    body: {
      access_token: accessToken,
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
  });
};

export const updateConnectionSelection = async (
  env: Env,
  userId: string,
  payload: UpdateSelectionPayload,
): Promise<GoogleSpreadsheetConnectionRow | null> => {
  const body = {
    spreadsheet_id: payload.spreadsheetId,
    sheet_id: payload.sheetId,
    sheet_title: payload.sheetTitle ?? null,
    updated_at: new Date().toISOString(),
  };

  const rows = await request<GoogleSpreadsheetConnectionRow[]>(
    env,
    'PATCH',
    'google_spreadsheet_connections',
    {
      body,
      searchParams: { user_id: `eq.${userId}`, select: '*' },
      prefer: 'return=representation',
    },
  );

  return rows.length > 0 ? rows[0] : null;
};

export const saveColumnMapping = async (
  env: Env,
  payload: ColumnMappingPayload,
): Promise<GoogleSpreadsheetColumnMappingRow> => {
  const body = {
    connection_id: payload.connectionId,
    mappings: payload.mappings,
    required_columns: payload.requiredColumns ?? [
      'title',
      'startedAt',
      'endedAt',
      'durationSeconds',
    ],
    optional_columns: payload.optionalColumns ?? ['project', 'notes', 'tags', 'skill', 'intensity'],
    updated_at: new Date().toISOString(),
  };

  const rows = await request<GoogleSpreadsheetColumnMappingRow[]>(
    env,
    'POST',
    'google_spreadsheet_column_mappings',
    {
      body,
      searchParams: {
        on_conflict: 'connection_id',
        select: '*',
      },
      prefer: 'resolution=merge-duplicates,return=representation',
    },
  );

  return rows[0];
};

export const getColumnMappingByConnection = async (
  env: Env,
  connectionId: string,
): Promise<GoogleSpreadsheetColumnMappingRow | null> => {
  const rows = await request<GoogleSpreadsheetColumnMappingRow[]>(
    env,
    'GET',
    'google_spreadsheet_column_mappings',
    {
      searchParams: {
        connection_id: `eq.${connectionId}`,
        select: '*',
        limit: '1',
      },
    },
  );
  return rows.length > 0 ? rows[0] : null;
};

export const createSyncLog = async (
  env: Env,
  payload: CreateSyncLogPayload,
): Promise<GoogleSyncLogRow> => {
  const existing = await findSyncLog(env, payload.connectionId, payload.sessionId);
  const body = {
    connection_id: payload.connectionId,
    session_id: payload.sessionId,
    status: 'pending' as const,
    google_append_request: payload.googleAppendRequest ?? null,
    updated_at: new Date().toISOString(),
  };

  if (!existing) {
    const rows = await request<GoogleSyncLogRow[]>(env, 'POST', 'google_sync_logs', {
      body,
      searchParams: {
        select: '*',
      },
      prefer: 'return=representation',
    });
    return rows[0];
  }

  const rows = await request<GoogleSyncLogRow[]>(env, 'PATCH', 'google_sync_logs', {
    body,
    searchParams: {
      connection_id: `eq.${payload.connectionId}`,
      session_id: `eq.${payload.sessionId}`,
      select: '*',
    },
    prefer: 'return=representation',
  });

  if (rows.length === 0) {
    throw new SupabaseRepositoryError('Failed to upsert sync log', 409);
  }

  return rows[0];
};

export const updateSyncLog = async (
  env: Env,
  logId: string,
  payload: UpdateSyncLogPayload,
): Promise<GoogleSyncLogRow> => {
  const body: Record<string, unknown> = {
    status: payload.status,
    failure_reason: payload.failureReason ?? null,
    google_append_response: payload.googleAppendResponse ?? null,
    updated_at: new Date().toISOString(),
  };

  if (typeof payload.retryCount === 'number') {
    body.retry_count = payload.retryCount;
  }

  const rows = await request<GoogleSyncLogRow[]>(env, 'PATCH', 'google_sync_logs', {
    body,
    searchParams: { id: `eq.${logId}`, select: '*' },
    prefer: 'return=representation',
  });

  if (rows.length === 0) {
    throw new SupabaseRepositoryError(`Sync log not found for id ${logId}`, 404);
  }

  return rows[0];
};

export const findSyncLog = async (
  env: Env,
  connectionId: string,
  sessionId: string,
): Promise<GoogleSyncLogRow | null> => {
  const rows = await request<GoogleSyncLogRow[]>(env, 'GET', 'google_sync_logs', {
    searchParams: {
      connection_id: `eq.${connectionId}`,
      session_id: `eq.${sessionId}`,
      select: '*',
      limit: '1',
    },
  });
  return rows.length > 0 ? rows[0] : null;
};
