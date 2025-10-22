import type { Env } from '../env';
import {
  extractBearerToken,
  verifySupabaseJwt,
  SupabaseAuthError,
} from '../auth/verifySupabaseJwt';
import {
  getConnectionByUser,
  getColumnMappingByConnection,
  SupabaseRepositoryError,
} from '../repositories/googleConnections';
import { ensureValidAccessToken } from './oauth';
import {
  badRequest,
  conflict,
  jsonResponse,
  serverError,
  unauthorized,
} from '../http/response';
import {
  GoogleSheetsClient,
  GoogleSheetsApiError,
} from '../services/googleSheetsClient';
import type {
  ColumnMapping,
  RunningSessionStartRequest,
  RunningSessionUpdateRequest,
  RunningSessionDraftPayload,
} from '../types';
import {
  columnKeyToIndex,
  formatDateTime,
  requiresHeaderLookup,
  resolveColumnLetter,
} from '../utils/googleSheets';

class HttpResponseError extends Error {
  readonly response: Response;

  constructor(response: Response) {
    super(`HTTP ${response.status}`);
    this.response = response;
  }
}

const buildRunningRowValues = (
  draft: RunningSessionDraftPayload,
  mapping: ColumnMapping,
  headerRow: (string | number)[] | null,
): (string | number | null)[] => {
  const positions = new Map<number, string | number | null>();

  const assign = (key: keyof ColumnMapping, value: string | number | null) => {
    const column = resolveColumnLetter(mapping[key], headerRow);
    if (!column) return;
    positions.set(columnKeyToIndex(column), value ?? '');
  };

  assign('id', draft.id);
  assign('status', 'Running');
  assign('title', draft.title ?? '');
  assign('startedAt', formatDateTime(draft.startedAt));
  assign('endedAt', '');
  assign('durationSeconds', 0);
  assign('project', draft.project ?? '');
  assign('notes', draft.notes ?? '');
  assign('tags', (draft.tags ?? []).join(','));
  assign('skill', draft.skill ?? '');
  assign('intensity', draft.intensity ?? '');

  if (positions.size === 0) {
    return [];
  }

  const maxIndex = Math.max(...positions.keys());
  const values: (string | number | null)[] = new Array(maxIndex + 1).fill('');
  for (const [index, value] of positions.entries()) {
    values[index] = value;
  }
  return values;
};

const validateDraft = (draft: RunningSessionDraftPayload) => {
  if (!draft || typeof draft !== 'object') {
    throw new Error('draft is required');
  }
  if (!draft.id || typeof draft.id !== 'string') {
    throw new Error('draft.id is required');
  }
  if (!draft.title || typeof draft.title !== 'string') {
    throw new Error('draft.title is required');
  }
  if (!draft.startedAt || typeof draft.startedAt !== 'string') {
    throw new Error('draft.startedAt is required');
  }
};

const resolveConnectionContext = async (
  env: Env,
  userId: string,
) => {
  let connection;
  try {
    connection = await getConnectionByUser(env, userId);
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      throw serverError(
        error.message,
        error.status >= 500 ? 502 : error.status,
      );
    }
    throw error;
  }
  if (!connection) {
    throw new HttpResponseError(
      conflict('connection_missing', 'Google spreadsheet connection not found'),
    );
  }
  if (connection.status !== 'active') {
    throw new HttpResponseError(
      conflict('connection_inactive', 'Google spreadsheet connection is not active'),
    );
  }
  if (!connection.spreadsheet_id || !connection.sheet_title) {
    throw new HttpResponseError(
      conflict(
        'selection_missing',
        'Spreadsheet or sheet selection is not configured',
      ),
    );
  }

  let mappingRow;
  try {
    mappingRow = await getColumnMappingByConnection(env, connection.id);
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      throw serverError(
        error.message,
        error.status >= 500 ? 502 : error.status,
      );
    }
    throw error;
  }

  const mappings =
    mappingRow?.mappings && typeof mappingRow.mappings === 'object'
      ? (mappingRow.mappings as ColumnMapping)
      : null;

  if (!mappings) {
    throw new HttpResponseError(
      conflict('mapping_missing', 'Column mapping is not configured'),
    );
  }

  if (!mappings.id || !mappings.id.trim() || !mappings.status || !mappings.status.trim()) {
    throw new HttpResponseError(
      conflict(
        'mapping_incomplete',
        'ID and status columns must be configured for running sync',
      ),
    );
  }

  return { connection, mappings } as const;
};

const ensureAuthorized = async (request: Request, env: Env) => {
  const token = extractBearerToken(request);
  if (!token) {
    throw new HttpResponseError(unauthorized('Bearer token is required'));
  }

  try {
    return await verifySupabaseJwt(token, env);
  } catch (error) {
    if (error instanceof SupabaseAuthError) {
      throw new HttpResponseError(unauthorized(error.message));
    }
    throw new HttpResponseError(unauthorized('Invalid token'));
  }
};

const parseJson = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T;
  } catch (error) {
    throw new HttpResponseError(
      badRequest(error instanceof Error ? error.message : 'Invalid request body'),
    );
  }
};

export const handleRunningSessionStart = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const body = await parseJson<RunningSessionStartRequest>(request);
    validateDraft(body?.draft);

    const { connection, mappings } = await resolveConnectionContext(
      env,
      auth.userId,
    );

    const accessToken = await ensureValidAccessToken(env, connection);
    const client = GoogleSheetsClient.fromAccessToken(accessToken);

    let headerRow: (string | number)[] | null = null;
    if (requiresHeaderLookup(mappings)) {
      try {
        const header = await client.getRange(
          connection.spreadsheet_id,
          `${connection.sheet_title}!1:1`,
        );
        headerRow = header.values?.[0] ?? null;
      } catch (error) {
        console.warn('Failed to load header row for running sync', error);
      }
    }

    const values = buildRunningRowValues(body.draft, mappings, headerRow);

    if (values.length === 0) {
      throw new HttpResponseError(
        conflict(
          'mapping_incomplete',
          'Column mapping must include at least one field for running sync',
        ),
      );
    }

    await client.appendRow(
      connection.spreadsheet_id,
      connection.sheet_title,
      values,
      { valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS' },
    );

    return jsonResponse({ status: 'ok' }, 202);
  } catch (responseOrError) {
    if (responseOrError instanceof HttpResponseError) {
      return responseOrError.response;
    }
    if (responseOrError instanceof GoogleSheetsApiError) {
      return serverError(responseOrError.message, responseOrError.status);
    }
    if (responseOrError instanceof Error) {
      return serverError(responseOrError.message, 500);
    }
    return serverError('Unknown error', 500);
  }
};

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
      return index + 1; // 1-based row number
    }
  }
  return null;
};

const buildUpdateData = (
  sheetTitle: string,
  rowNumber: number,
  mapping: ColumnMapping,
  draft: RunningSessionDraftPayload,
  elapsedSeconds: number,
  headerRow: (string | number)[] | null,
) => {
  const updates: Array<{ range: string; values: (string | number | null)[][] }> = [];

  const add = (key: keyof ColumnMapping, value: string | number | null) => {
    const column = resolveColumnLetter(mapping[key], headerRow);
    if (!column) return;
    updates.push({
      range: `${sheetTitle}!${column}${rowNumber}`,
      values: [[value ?? '']],
    });
  };

  add('status', 'Running');
  add('title', draft.title ?? '');
  add('startedAt', formatDateTime(draft.startedAt));
  add('project', draft.project ?? '');
  add('notes', draft.notes ?? '');
  add('tags', (draft.tags ?? []).join(','));
  add('skill', draft.skill ?? '');
  add('intensity', draft.intensity ?? '');
  add('durationSeconds', elapsedSeconds);

  return updates;
};

export const handleRunningSessionUpdate = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const body = await parseJson<RunningSessionUpdateRequest>(request);
    validateDraft(body?.draft);

    if (
      typeof body.elapsedSeconds !== 'number' ||
      Number.isNaN(body.elapsedSeconds) ||
      body.elapsedSeconds < 0
    ) {
      throw new HttpResponseError(
        badRequest('elapsedSeconds must be a non-negative number'),
      );
    }

    const { connection, mappings } = await resolveConnectionContext(
      env,
      auth.userId,
    );

    const accessToken = await ensureValidAccessToken(env, connection);
    const client = GoogleSheetsClient.fromAccessToken(accessToken);

    let headerRow: (string | number)[] | null = null;
    if (requiresHeaderLookup(mappings)) {
      try {
        const header = await client.getRange(
          connection.spreadsheet_id,
          `${connection.sheet_title}!1:1`,
        );
        headerRow = header.values?.[0] ?? null;
      } catch (error) {
        console.warn('Failed to load header row for running sync', error);
      }
    }

    const idColumn = resolveColumnLetter(mappings.id, headerRow);
    if (!idColumn) {
      throw new HttpResponseError(
        conflict(
          'mapping_incomplete',
          'ID column must be configured for running sync',
        ),
      );
    }

    const rowNumber = await findRowNumberById(
      client,
      connection.spreadsheet_id,
      connection.sheet_title,
      idColumn,
      body.draft.id,
    );

    if (!rowNumber) {
      return conflict('row_not_found', 'Running session row not found');
    }

    const updates = buildUpdateData(
      connection.sheet_title,
      rowNumber,
      mappings,
      body.draft,
      Math.floor(body.elapsedSeconds),
      headerRow,
    );

    if (updates.length === 0) {
      return jsonResponse({ status: 'ok' }, 202);
    }

    await client.batchUpdateValues(connection.spreadsheet_id, updates, 'USER_ENTERED');

    return jsonResponse({ status: 'ok' }, 202);
  } catch (responseOrError) {
    if (responseOrError instanceof HttpResponseError) {
      return responseOrError.response;
    }
    if (responseOrError instanceof GoogleSheetsApiError) {
      return serverError(responseOrError.message, responseOrError.status);
    }
    if (responseOrError instanceof Error) {
      return serverError(responseOrError.message, 500);
    }
    return serverError('Unknown error', 500);
  }
};
