import type { Env } from '../env';
import {
  extractBearerToken,
  verifySupabaseJwt,
  SupabaseAuthError,
} from '../auth/verifySupabaseJwt';
import {
  createSyncLog,
  findSyncLog,
  getColumnMappingByConnection,
  getConnectionByUser,
  updateSyncLog,
  SupabaseRepositoryError,
} from '../repositories/googleConnections';
import {
  GoogleSheetsApiError,
  GoogleSheetsClient,
} from '../services/googleSheetsClient';
import type {
  ColumnMapping,
  SyncLogPayload,
  SyncRequestBody,
  SyncSessionPayload,
} from '../types';
import {
  jsonResponse,
  badRequest,
  unauthorized,
  conflict,
  serverError,
} from '../http/response';
import { ensureValidAccessToken } from './oauth';
import {
  columnKeyToIndex,
  formatDateTime,
  requiresHeaderLookup,
  resolveColumnLetter,
} from '../utils/googleSheets';

type SyncDeleteRequestBody = {
  sessionId: string;
};

const normalizeSessionPayload = (session: SyncSessionPayload) => ({
  id: session.id,
  status: 'Completed' as const,
  title: session.title ?? '',
  startedAt: formatDateTime(session.startedAt),
  endedAt: formatDateTime(session.endedAt),
  durationSeconds: session.durationSeconds ?? 0,
  project: session.project ?? '',
  notes: session.notes ?? '',
  tags: (session.tags ?? []).join(', '),
  skill: session.skill ?? '',
  intensity: session.intensity ?? '',
});

const defaultColumnOrder: Array<keyof ReturnType<typeof normalizeSessionPayload>> =
  [
    'status',
    'title',
    'startedAt',
    'endedAt',
    'durationSeconds',
    'project',
    'notes',
    'tags',
    'skill',
    'intensity',
  ];

/**
 * 列記号（A, B, C, ...）を0始まりの数値インデックスに変換
 * A -> 0, B -> 1, C -> 2, ...
 */
const findRowNumberById = async (
  client: GoogleSheetsClient,
  spreadsheetId: string,
  sheetTitle: string,
  columnKey: string,
  targetId: string,
): Promise<number | null> => {
  const range = `${sheetTitle}!${columnKey}:${columnKey}`;
  const result = await client.getRange(spreadsheetId, range);
  const values = result.values ?? [];
  for (let index = 0; index < values.length; index++) {
    const row = values[index];
    if (row && String(row[0]).trim() === targetId) {
      return index + 1;
    }
  }
  return null;
};

const buildCompletionUpdates = (
  sheetTitle: string,
  rowNumber: number,
  mapping: ColumnMapping | null,
  normalized: ReturnType<typeof normalizeSessionPayload>,
  headerRow: (string | number)[] | null,
) => {
  if (!mapping) return [] as Array<{ range: string; values: (string | number | null)[][] }>;

  const updates: Array<{ range: string; values: (string | number | null)[][] }> = [];

  const add = (key: keyof ColumnMapping, value: string | number | null) => {
    const column = resolveColumnLetter(mapping[key], headerRow);
    if (!column) return;
    updates.push({
      range: `${sheetTitle}!${column}${rowNumber}`,
      values: [[value ?? '']],
    });
  };

  add('status', 'Completed');
  add('title', normalized.title);
  add('startedAt', normalized.startedAt);
  add('endedAt', normalized.endedAt);
  add('durationSeconds', normalized.durationSeconds);
  add('project', normalized.project);
  add('notes', normalized.notes);
  add('tags', normalized.tags);
  add('skill', normalized.skill);
  add('intensity', normalized.intensity);

  return updates;
};

const buildRowValues = (
  session: SyncSessionPayload,
  mapping: ColumnMapping | null,
  headerRow: (string | number)[] | null,
): (string | number)[] => {
  const normalized = normalizeSessionPayload(session);

  if (!mapping) {
    return defaultColumnOrder.map((key) => normalized[key]);
  }

  // マッピングから列インデックスを取得して、値を適切な位置に配置
  const columnPositions: Array<{ index: number; value: string | number }> = [];

  const assign = (key: keyof ColumnMapping, value: string | number | null) => {
    const column = resolveColumnLetter(mapping[key], headerRow);
    if (!column) return;
    columnPositions.push({
      index: columnKeyToIndex(column),
      value: value ?? '',
    });
  };

  assign('id', normalized.id);
  assign('status', normalized.status);
  assign('title', normalized.title);
  assign('startedAt', normalized.startedAt);
  assign('endedAt', normalized.endedAt);
  assign('durationSeconds', normalized.durationSeconds);
  assign('project', normalized.project);
  assign('notes', normalized.notes);
  assign('tags', normalized.tags);
  assign('skill', normalized.skill);
  assign('intensity', normalized.intensity);

  if (columnPositions.length === 0) {
    return defaultColumnOrder.map((key) => normalized[key]);
  }

  // インデックスでソートして、配列を構築
  columnPositions.sort((a, b) => a.index - b.index);

  const maxIndex = Math.max(...columnPositions.map((p) => p.index));
  const values: (string | number)[] = new Array(maxIndex + 1).fill('');

  for (const { index, value } of columnPositions) {
    values[index] = value;
  }

  return values;
};

const mapLogPayload = (input: {
  id: string;
  session_id: string;
  status: 'pending' | 'success' | 'failed';
  attempted_at: string;
  failure_reason: string | null;
  retry_count: number;
}): SyncLogPayload => ({
  id: input.id,
  sessionId: input.session_id,
  status: input.status,
  attemptedAt: input.attempted_at,
  failureReason: input.failure_reason,
  retryCount: input.retry_count,
});

const parseRequestBody = async (request: Request): Promise<SyncRequestBody> => {
  try {
    const parsed = (await request.json()) as SyncRequestBody;
    if (!parsed?.session) {
      throw new Error('Missing session payload');
    }
    return parsed;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Invalid request body',
    );
  }
};

const validateSessionPayload = (session: SyncSessionPayload) => {
  if (!session.id || typeof session.id !== 'string') {
    throw new Error('session.id is required');
  }
  if (!session.title || typeof session.title !== 'string') {
    throw new Error('session.title is required');
  }
  if (!session.startedAt || typeof session.startedAt !== 'string') {
    throw new Error('session.startedAt is required');
  }
  if (!session.endedAt || typeof session.endedAt !== 'string') {
    throw new Error('session.endedAt is required');
  }
  if (
    typeof session.durationSeconds !== 'number' ||
    Number.isNaN(session.durationSeconds)
  ) {
    throw new Error('session.durationSeconds must be a number');
  }
};

export const handleSyncSession = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  const token = extractBearerToken(request);
  if (!token) {
    return unauthorized('Bearer token is required');
  }

  let payload: SyncRequestBody;
  try {
    payload = await parseRequestBody(request);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Bad Request');
  }

  try {
    validateSessionPayload(payload.session);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Bad Request');
  }

  let auth;
  try {
    auth = await verifySupabaseJwt(token, env);
  } catch (error) {
    if (error instanceof SupabaseAuthError) {
      return unauthorized(error.message);
    }
    return unauthorized('Invalid token');
  }

  let connection;
  try {
    connection = await getConnectionByUser(env, auth.userId);
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return serverError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }
  if (!connection) {
    return conflict('connection_missing', 'Google spreadsheet connection not found');
  }
  if (connection.status !== 'active') {
    return conflict('connection_inactive', 'Google spreadsheet connection is not active');
  }
  if (!connection.spreadsheet_id || !connection.sheet_title) {
    return conflict(
      'selection_missing',
      'Spreadsheet or sheet selection is not configured',
    );
  }

  let mappingRow;
  try {
    mappingRow = await getColumnMappingByConnection(env, connection.id);
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return serverError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }
  const mappings =
    mappingRow?.mappings && typeof mappingRow.mappings === 'object'
      ? (mappingRow.mappings as ColumnMapping)
      : null;

  let syncLog;
  try {
    syncLog = await createSyncLog(env, {
      connectionId: connection.id,
      sessionId: payload.session.id,
      googleAppendRequest: {
        sessionId: payload.session.id,
      },
    });
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return serverError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }

  // トークンが期限切れの場合はリフレッシュ
  let accessToken: string;
  try {
    accessToken = await ensureValidAccessToken(env, connection);
  } catch (error) {
    return serverError(
      error instanceof Error ? error.message : 'Failed to refresh access token',
      401,
    );
  }

  const client = GoogleSheetsClient.fromAccessToken(accessToken);

  try {
    // ヘッダー名を使用したマッピングの場合、ヘッダー行を読み取る
    let headerRow: (string | number)[] | null = null;
    if (requiresHeaderLookup(mappings ?? null)) {
      try {
        const range = `${connection.sheet_title}!1:1`;
        const result = await client.getRange(connection.spreadsheet_id, range);
        headerRow = result.values?.[0] ?? null;
      } catch (error) {
        console.warn('Failed to read header row:', error);
      }
    }

    const normalizedSession = normalizeSessionPayload(payload.session);
    const rowValues = buildRowValues(payload.session, mappings, headerRow);

    const idColumn = mappings ? resolveColumnLetter(mappings.id, headerRow) : null;
    let existingRowNumber: number | null = null;

    if (idColumn) {
      try {
        existingRowNumber = await findRowNumberById(
          client,
          connection.spreadsheet_id,
          connection.sheet_title,
          idColumn,
          payload.session.id,
        );
      } catch (error) {
        console.warn('Failed to locate existing row for session id', error);
      }
    }

    let appendResult: Record<string, unknown> | null = null;

    if (existingRowNumber) {
      const updates = buildCompletionUpdates(
        connection.sheet_title,
        existingRowNumber,
        mappings,
        normalizedSession,
        headerRow,
      );

      if (updates.length > 0) {
        await client.batchUpdateValues(
          connection.spreadsheet_id,
          updates,
          'USER_ENTERED',
        );
      }
    } else {
      appendResult = (await client.appendRow(
        connection.spreadsheet_id,
        connection.sheet_title,
        rowValues,
        {
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
        },
      )) as Record<string, unknown>;
    }

    let updated;
    try {
      updated = await updateSyncLog(env, syncLog.id, {
        status: 'success',
        failureReason: null,
        googleAppendResponse: appendResult,
      });
    } catch (updateError) {
      if (updateError instanceof SupabaseRepositoryError) {
        return serverError(
          updateError.message,
          updateError.status >= 500 ? 502 : updateError.status,
        );
      }
      throw updateError;
    }

    return jsonResponse(mapLogPayload(updated), 202);
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message : 'Unknown error';
    try {
      await updateSyncLog(env, syncLog.id, {
        status: 'failed',
        failureReason,
      });
    } catch (updateError) {
      if (updateError instanceof SupabaseRepositoryError) {
        return serverError(
          updateError.message,
          updateError.status >= 500 ? 502 : updateError.status,
        );
      }
      throw updateError;
    }

    const status =
      error instanceof GoogleSheetsApiError && error.status === 401
        ? 401
        : error instanceof GoogleSheetsApiError && error.status >= 500
          ? 502
          : 500;
    return serverError(failureReason, status);
  }
};

export const handleDeleteSyncedSession = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  let body: SyncDeleteRequestBody;
  try {
    body = (await request.json()) as SyncDeleteRequestBody;
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : 'Invalid request body',
    );
  }

  if (!body || typeof body.sessionId !== 'string' || body.sessionId.trim().length === 0) {
    return badRequest('sessionId is required');
  }

  const token = extractBearerToken(request);
  if (!token) {
    return unauthorized('Bearer token is required');
  }

  let auth;
  try {
    auth = await verifySupabaseJwt(token, env);
  } catch (error) {
    if (error instanceof SupabaseAuthError) {
      return unauthorized(error.message);
    }
    return unauthorized('Invalid token');
  }

  let connection;
  try {
    connection = await getConnectionByUser(env, auth.userId);
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return serverError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }

  if (!connection) {
    return conflict('connection_missing', 'Google spreadsheet connection not found');
  }
  if (connection.status !== 'active') {
    return conflict('connection_inactive', 'Google spreadsheet connection is not active');
  }
  if (!connection.spreadsheet_id || !connection.sheet_id || !connection.sheet_title) {
    return conflict('selection_missing', 'Spreadsheet or sheet selection is not configured');
  }

  let mappingsRow;
  try {
    mappingsRow = await getColumnMappingByConnection(env, connection.id);
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return serverError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }

  const mappings =
    mappingsRow?.mappings && typeof mappingsRow.mappings === 'object'
      ? (mappingsRow.mappings as ColumnMapping)
      : null;

  const idColumn = mappings ? mappings.id : undefined;
  if (!idColumn || !idColumn.trim()) {
    return conflict('mapping_incomplete', 'ID column must be configured to delete sessions');
  }

  let accessToken: string;
  try {
    accessToken = await ensureValidAccessToken(env, connection);
  } catch (error) {
    return serverError(
      error instanceof Error ? error.message : 'Failed to refresh access token',
      401,
    );
  }

  const client = GoogleSheetsClient.fromAccessToken(accessToken);

  try {
    let headerRow: (string | number)[] | null = null;
    if (requiresHeaderLookup(mappings ?? null)) {
      try {
        const headerRange = `${connection.sheet_title}!1:1`;
        const result = await client.getRange(connection.spreadsheet_id, headerRange);
        headerRow = result.values?.[0] ?? null;
      } catch (error) {
        console.warn('Failed to load header row for delete', error);
      }
    }

    const resolvedColumn = resolveColumnLetter(idColumn, headerRow);
    if (!resolvedColumn) {
      return conflict('mapping_incomplete', 'ID column mapping is invalid');
    }

    const rowNumber = await findRowNumberById(
      client,
      connection.spreadsheet_id,
      connection.sheet_title,
      resolvedColumn,
      body.sessionId,
    );

    if (!rowNumber) {
      return jsonResponse({ status: 'skipped' }, 202);
    }

    await client.deleteRows(
      connection.spreadsheet_id,
      connection.sheet_id,
      rowNumber - 1,
      rowNumber,
    );

    try {
      const existingLog = await findSyncLog(env, connection.id, body.sessionId);
      if (existingLog) {
        await updateSyncLog(env, existingLog.id, {
          status: 'success',
          failureReason: null,
          googleAppendResponse: { action: 'deleted' },
        });
      }
    } catch (error) {
      if (error instanceof SupabaseRepositoryError) {
        return serverError(
          error.message,
          error.status >= 500 ? 502 : error.status,
        );
      }
      throw error;
    }

    return jsonResponse({ status: 'ok' }, 202);
  } catch (error) {
    if (error instanceof GoogleSheetsApiError) {
      const status = error.status >= 500 ? 502 : error.status;
      return serverError(error.message, status);
    }
    if (error instanceof Error) {
      return serverError(error.message, 500);
    }
    return serverError('Unknown error', 500);
  }
};
