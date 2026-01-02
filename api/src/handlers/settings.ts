import {
  extractBearerToken,
  SupabaseAuthError,
  verifySupabaseJwt,
} from '../auth/verifySupabaseJwt';
import type { Env } from '../env';
import { badRequest, conflict, jsonResponse, serverError, unauthorized } from '../http/response';
import {
  getColumnMappingByConnection,
  getConnectionByUser,
  SupabaseRepositoryError,
  saveColumnMapping,
  updateConnectionSelection,
} from '../repositories/googleConnections';
import { GoogleSheetsApiError, GoogleSheetsClient } from '../services/googleSheetsClient';
import { ensureValidAccessToken } from './oauth';

type ConnectionRow = Awaited<ReturnType<typeof getConnectionByUser>>;

type MappingRow = Awaited<ReturnType<typeof getColumnMappingByConnection>>;

const mapColumnMapping = (mapping: NonNullable<MappingRow>) => ({
  mappings: mapping.mappings as Record<string, string>,
  requiredColumns: mapping.required_columns,
  optionalColumns: mapping.optional_columns,
});

const mapSettingsResponse = (connection: ConnectionRow, mapping: MappingRow) => {
  if (!connection) {
    return {
      connectionStatus: 'revoked',
      spreadsheet: null,
      columnMapping: null,
      updatedAt: null,
    };
  }

  const spreadsheet =
    connection.spreadsheet_id && connection.sheet_id != null
      ? {
          id: connection.spreadsheet_id,
          sheetId: connection.sheet_id,
          sheetTitle: connection.sheet_title ?? '',
        }
      : null;

  return {
    connectionStatus: connection.status,
    spreadsheet,
    columnMapping: mapping ? mapColumnMapping(mapping) : null,
    updatedAt: connection.updated_at ?? null,
  };
};

const ensureBearer = (request: Request): string | null => {
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }
  return token;
};

export const handleGetSettings = async (request: Request, env: Env): Promise<Response> => {
  const token = ensureBearer(request);
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

  let connection: ConnectionRow;
  try {
    connection = await getConnectionByUser(env, auth.userId);
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return serverError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }

  let mapping: MappingRow = null;
  if (connection) {
    try {
      mapping = await getColumnMappingByConnection(env, connection.id);
    } catch (error) {
      if (error instanceof SupabaseRepositoryError) {
        return serverError(error.message, error.status >= 500 ? 502 : error.status);
      }
      throw error;
    }
  }

  return jsonResponse(mapSettingsResponse(connection, mapping));
};

type UpdateSettingsPayload = {
  spreadsheetId?: unknown;
  sheetId?: unknown;
  sheetTitle?: unknown;
  columnMapping?: unknown;
};

const parseUpdatePayload = async (
  request: Request,
): Promise<{
  spreadsheetId: string;
  sheetId: number;
  sheetTitle: string;
  columnMapping: Record<string, string> | null;
}> => {
  let payload: UpdateSettingsPayload;
  try {
    payload = (await request.json()) as UpdateSettingsPayload;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid request body');
  }

  const spreadsheetId = payload.spreadsheetId;
  const sheetId = payload.sheetId;
  const sheetTitle = payload.sheetTitle;

  if (typeof spreadsheetId !== 'string' || spreadsheetId.trim().length === 0) {
    throw new Error('spreadsheetId is required');
  }
  if (typeof sheetId !== 'number' || Number.isNaN(sheetId)) {
    throw new Error('sheetId must be a number');
  }
  if (typeof sheetTitle !== 'string' || sheetTitle.trim().length === 0) {
    throw new Error('sheetTitle is required');
  }

  let columnMapping: Record<string, string> | null = null;
  if (payload.columnMapping && typeof payload.columnMapping === 'object') {
    columnMapping = Object.entries(payload.columnMapping as Record<string, unknown>)
      .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
      .reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = (value as string).trim();
        return acc;
      }, {});
  }

  return {
    spreadsheetId: spreadsheetId.trim(),
    sheetId,
    sheetTitle: sheetTitle.trim(),
    columnMapping: columnMapping && Object.keys(columnMapping).length > 0 ? columnMapping : null,
  };
};

export const handleUpdateSettings = async (request: Request, env: Env): Promise<Response> => {
  const token = ensureBearer(request);
  if (!token) {
    return unauthorized('Bearer token is required');
  }

  let payload;
  try {
    payload = await parseUpdatePayload(request);
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

  let connection: ConnectionRow;
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

  let updatedConnection: ConnectionRow = connection;
  try {
    updatedConnection = await updateConnectionSelection(env, auth.userId, {
      spreadsheetId: payload.spreadsheetId,
      sheetId: payload.sheetId,
      sheetTitle: payload.sheetTitle,
    });
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return serverError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }

  if (payload.columnMapping) {
    try {
      await saveColumnMapping(env, {
        connectionId: updatedConnection?.id ?? connection.id,
        mappings: payload.columnMapping,
      });
    } catch (error) {
      if (error instanceof SupabaseRepositoryError) {
        return serverError(error.message, error.status >= 500 ? 502 : error.status);
      }
      throw error;
    }
  }

  let mapping: MappingRow = null;
  try {
    mapping = await getColumnMappingByConnection(env, updatedConnection?.id ?? connection.id);
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return serverError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }

  return jsonResponse(mapSettingsResponse(updatedConnection ?? connection, mapping));
};

const ensureActiveConnection = async (env: Env, userId: string) => {
  try {
    const connection = await getConnectionByUser(env, userId);
    if (!connection) {
      return {
        error: conflict('connection_missing', 'Google spreadsheet connection not found'),
        connection: null,
      } as const;
    }
    if (connection.status !== 'active') {
      return {
        error: conflict('connection_inactive', 'Google spreadsheet connection is not active'),
        connection: null,
      } as const;
    }
    return { connection, error: null } as const;
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return {
        connection: null,
        error: serverError(error.message, error.status >= 500 ? 502 : error.status),
      } as const;
    }
    throw error;
  }
};

export const handleListSpreadsheets = async (request: Request, env: Env): Promise<Response> => {
  const token = ensureBearer(request);
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

  const { connection, error } = await ensureActiveConnection(env, auth.userId);
  if (error || !connection) {
    return error ?? conflict('connection_missing', 'Google spreadsheet connection not found');
  }

  // トークンが期限切れの場合はリフレッシュ
  let accessToken: string;
  try {
    accessToken = await ensureValidAccessToken(env, connection);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to refresh access token', 401);
  }

  const client = GoogleSheetsClient.fromAccessToken(accessToken);
  const query = new URL(request.url).searchParams.get('q') ?? undefined;

  try {
    const result = await client.listSpreadsheets(query?.trim() || undefined);
    return jsonResponse(result ?? { items: [] });
  } catch (err) {
    if (err instanceof GoogleSheetsApiError) {
      const status = err.status === 401 ? 401 : err.status >= 500 ? 502 : err.status;
      return serverError(err.message, status);
    }
    throw err;
  }
};

const parseSpreadsheetIdFromPath = (request: Request): string | null => {
  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  // expecting integrations/google/spreadsheets/{id}/sheets
  if (segments.length < 5) {
    return null;
  }
  return decodeURIComponent(segments[3] ?? '');
};

export const handleListSheets = async (request: Request, env: Env): Promise<Response> => {
  const token = ensureBearer(request);
  if (!token) {
    return unauthorized('Bearer token is required');
  }

  const spreadsheetId = parseSpreadsheetIdFromPath(request);
  if (!spreadsheetId) {
    return badRequest('Spreadsheet id is required');
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

  const { connection, error } = await ensureActiveConnection(env, auth.userId);
  if (error || !connection) {
    return error ?? conflict('connection_missing', 'Google spreadsheet connection not found');
  }

  // トークンが期限切れの場合はリフレッシュ
  let accessToken: string;
  try {
    accessToken = await ensureValidAccessToken(env, connection);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to refresh access token', 401);
  }

  const client = GoogleSheetsClient.fromAccessToken(accessToken);

  try {
    const sheets = await client.getSpreadsheetSheets(spreadsheetId);
    return jsonResponse({ items: sheets ?? [] });
  } catch (err) {
    if (err instanceof GoogleSheetsApiError) {
      const status = err.status === 401 ? 401 : err.status >= 500 ? 502 : err.status;
      return serverError(err.message, status);
    }
    throw err;
  }
};
