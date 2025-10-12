import type { Env } from '../env';
import {
  extractBearerToken,
  verifySupabaseJwt,
  SupabaseAuthError,
} from '../auth/verifySupabaseJwt';
import {
  createSyncLog,
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

const formatDateTime = (input: string): string => {
  const date = new Date(input);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const normalizeSessionPayload = (session: SyncSessionPayload) => ({
  id: session.id,
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
const parseColumnKey = (columnKey: string): number | null => {
  const trimmed = columnKey.trim().toUpperCase();

  // 列記号（A, B, C, ...）の場合
  if (/^[A-Z]+$/u.test(trimmed)) {
    let index = 0;
    for (let i = 0; i < trimmed.length; i++) {
      index = index * 26 + (trimmed.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return index - 1; // 0始まりに変換
  }

  // 列記号でない場合はnull（ヘッダー名として扱う）
  return null;
};

/**
 * ヘッダー行からヘッダー名に対応する列インデックスを取得
 */
const findColumnIndexByHeader = (
  headerRow: (string | number)[],
  headerName: string,
): number | null => {
  const index = headerRow.findIndex(
    (cell) => String(cell).trim() === headerName.trim(),
  );
  return index >= 0 ? index : null;
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

  for (const key of Object.keys(mapping) as Array<keyof ColumnMapping>) {
    const columnKey = mapping[key];
    if (!columnKey) {
      continue;
    }

    // 列記号（A, B, Cなど）を数値インデックスに変換
    let columnIndex = parseColumnKey(columnKey);

    // 列記号でない場合は、ヘッダー名として扱う
    if (columnIndex === null && headerRow) {
      columnIndex = findColumnIndexByHeader(headerRow, columnKey);
    }

    if (columnIndex !== null) {
      columnPositions.push({
        index: columnIndex,
        value: normalized[key as keyof typeof normalized],
      });
    }
  }

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

  const client = GoogleSheetsClient.fromAccessToken(connection.access_token);

  try {
    // ヘッダー名を使用したマッピングの場合、ヘッダー行を読み取る
    let headerRow: (string | number)[] | null = null;
    if (mappings) {
      const hasHeaderMapping = Object.values(mappings).some(
        (key) => key && parseColumnKey(key) === null,
      );
      if (hasHeaderMapping) {
        try {
          const range = `${connection.sheet_title}!1:1`;
          const result = await client.getRange(connection.spreadsheet_id, range);
          headerRow = result.values?.[0] ?? null;
        } catch (error) {
          // ヘッダー行の読み取りに失敗した場合は警告してnullのまま続行
          console.warn('Failed to read header row:', error);
        }
      }
    }

    const rowValues = buildRowValues(payload.session, mappings, headerRow);
    const appendResult = await client.appendRow(
      connection.spreadsheet_id,
      connection.sheet_title,
      rowValues,
      {
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
      },
    );

    let updated;
    try {
      updated = await updateSyncLog(env, syncLog.id, {
        status: 'success',
        failureReason: null,
        googleAppendResponse: appendResult ?? null,
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
