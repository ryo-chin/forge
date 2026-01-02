import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDeleteSyncedSession, handleSyncSession } from '../syncSession';

const mocks = vi.hoisted(() => {
  const verifySupabaseJwt = vi.fn();
  const getConnectionByUser = vi.fn();
  const getColumnMappingByConnection = vi.fn();
  const findSyncLog = vi.fn();
  const createSyncLog = vi.fn();
  const updateSyncLog = vi.fn();
  const appendRow = vi.fn();
  const getRange = vi.fn();
  const batchUpdateValues = vi.fn();
  const deleteRows = vi.fn();
  return {
    verifySupabaseJwt,
    getConnectionByUser,
    getColumnMappingByConnection,
    findSyncLog,
    createSyncLog,
    updateSyncLog,
    appendRow,
    getRange,
    batchUpdateValues,
    deleteRows,
  };
});

vi.mock('../../auth/verifySupabaseJwt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/verifySupabaseJwt')>();
  return {
    ...actual,
    verifySupabaseJwt: mocks.verifySupabaseJwt,
  };
});

vi.mock('../../repositories/googleConnections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../repositories/googleConnections')>();
  return {
    ...actual,
    getConnectionByUser: mocks.getConnectionByUser,
    getColumnMappingByConnection: mocks.getColumnMappingByConnection,
    findSyncLog: mocks.findSyncLog,
    createSyncLog: mocks.createSyncLog,
    updateSyncLog: mocks.updateSyncLog,
  };
});

vi.mock('../../services/googleSheetsClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/googleSheetsClient')>();
  return {
    ...actual,
    GoogleSheetsClient: {
      ...actual.GoogleSheetsClient,
      fromAccessToken: vi.fn(() => ({
        appendRow: mocks.appendRow,
        getRange: mocks.getRange,
        batchUpdateValues: mocks.batchUpdateValues,
        deleteRows: mocks.deleteRows,
      })),
    },
  };
});

const env = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  GOOGLE_REDIRECT_URI: '',
} as const;

const buildRequest = (body: unknown, token?: string) =>
  new Request('https://example.com/integrations/google/sync', {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
        },
    body: JSON.stringify(body),
  });

const buildDeleteRequest = (body: unknown, token?: string) =>
  new Request('https://example.com/integrations/google/sync/delete', {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
        },
    body: JSON.stringify(body),
  });

describe('handleSyncSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when authorization header is missing', async () => {
    const response = await handleSyncSession(buildRequest({ session: {} }), env);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'unauthorized',
    });
  });

  it('returns 409 when no spreadsheet connection exists', async () => {
    mocks.verifySupabaseJwt.mockResolvedValue({
      userId: 'user-1',
      raw: {},
    });
    mocks.getConnectionByUser.mockResolvedValue(null);

    const response = await handleSyncSession(
      buildRequest(
        {
          session: {
            id: 'session-1',
            title: 'Focus',
            startedAt: '2025-10-12T12:00:00.000Z',
            endedAt: '2025-10-12T13:00:00.000Z',
            durationSeconds: 3600,
          },
        },
        'token-123',
      ),
      env,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'connection_missing',
    });
  });

  it('appends the session to Google Sheets and returns sync log on success', async () => {
    mocks.verifySupabaseJwt.mockResolvedValue({
      userId: 'user-1',
      raw: {},
    });
    mocks.getConnectionByUser.mockResolvedValue({
      id: 'conn-1',
      user_id: 'user-1',
      google_user_id: 'google-1',
      spreadsheet_id: 'sheet-spreadsheet',
      sheet_id: 1,
      sheet_title: 'TimeTracker',
      access_token: 'g-access',
      refresh_token: 'g-refresh',
      access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mocks.getColumnMappingByConnection.mockResolvedValue(null);
    mocks.createSyncLog.mockResolvedValue({
      id: 'log-1',
      connection_id: 'conn-1',
      session_id: 'session-1',
      status: 'pending',
      attempted_at: new Date().toISOString(),
      failure_reason: null,
      google_append_request: null,
      google_append_response: null,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mocks.appendRow.mockResolvedValue({
      spreadsheetId: 'sheet-spreadsheet',
      updates: {
        updatedRange: 'TimeTracker!A2:D2',
        updatedRows: 1,
        updatedColumns: 4,
        updatedCells: 4,
      },
    });
    mocks.updateSyncLog.mockResolvedValue({
      id: 'log-1',
      connection_id: 'conn-1',
      session_id: 'session-1',
      status: 'success',
      attempted_at: new Date().toISOString(),
      failure_reason: null,
      google_append_request: null,
      google_append_response: {
        spreadsheetId: 'sheet-spreadsheet',
      },
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await handleSyncSession(
      buildRequest(
        {
          session: {
            id: 'session-1',
            title: 'Focus',
            startedAt: '2025-10-12T12:00:00.000Z',
            endedAt: '2025-10-12T13:00:00.000Z',
            durationSeconds: 3600,
            project: 'Project Alpha',
            notes: 'Deep work',
          },
        },
        'token-123',
      ),
      env,
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      id: 'log-1',
      sessionId: 'session-1',
      status: 'success',
    });

    expect(mocks.getConnectionByUser).toHaveBeenCalledWith(env, 'user-1');
    expect(mocks.createSyncLog).toHaveBeenCalledWith(
      env,
      expect.objectContaining({
        connectionId: 'conn-1',
        sessionId: 'session-1',
      }),
    );
    expect(mocks.appendRow).toHaveBeenCalledWith(
      'sheet-spreadsheet',
      'TimeTracker',
      expect.any(Array),
      expect.objectContaining({ valueInputOption: 'USER_ENTERED' }),
    );
    expect(mocks.updateSyncLog).toHaveBeenCalledWith(
      env,
      'log-1',
      expect.objectContaining({ status: 'success' }),
    );
  });

  it('updates existing running row when session id already exists', async () => {
    mocks.verifySupabaseJwt.mockResolvedValue({
      userId: 'user-1',
      raw: {},
    });
    mocks.getConnectionByUser.mockResolvedValue({
      id: 'conn-1',
      user_id: 'user-1',
      google_user_id: 'google-1',
      spreadsheet_id: 'sheet-spreadsheet',
      sheet_id: 1,
      sheet_title: 'TimeTracker',
      access_token: 'g-access',
      refresh_token: 'g-refresh',
      access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mocks.getColumnMappingByConnection.mockResolvedValue({
      id: 'mapping-1',
      connection_id: 'conn-1',
      mappings: {
        id: 'A',
        status: 'B',
        title: 'C',
        startedAt: 'D',
        endedAt: 'E',
        durationSeconds: 'F',
        project: 'G',
        notes: 'H',
        tags: 'I',
      },
      required_columns: [],
      optional_columns: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mocks.createSyncLog.mockResolvedValue({
      id: 'log-1',
      connection_id: 'conn-1',
      session_id: 'session-1',
      status: 'pending',
      attempted_at: new Date().toISOString(),
      failure_reason: null,
      google_append_request: null,
      google_append_response: null,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mocks.getRange.mockResolvedValue({
      values: [['session-1'], ['session-2']],
    });
    mocks.batchUpdateValues.mockResolvedValue(undefined);
    mocks.updateSyncLog.mockResolvedValue({
      id: 'log-1',
      connection_id: 'conn-1',
      session_id: 'session-1',
      status: 'success',
      attempted_at: new Date().toISOString(),
      failure_reason: null,
      google_append_request: null,
      google_append_response: null,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await handleSyncSession(
      buildRequest(
        {
          session: {
            id: 'session-1',
            title: 'Focus',
            startedAt: '2025-10-12T12:00:00.000Z',
            endedAt: '2025-10-12T13:00:00.000Z',
            durationSeconds: 3600,
            project: 'Project Alpha',
            notes: 'Deep work',
            tags: ['tag1'],
          },
        },
        'token-123',
      ),
      env,
    );

    expect(response.status).toBe(202);
    expect(mocks.appendRow).not.toHaveBeenCalled();
    expect(mocks.batchUpdateValues).toHaveBeenCalledTimes(1);
    const updatesArg = mocks.batchUpdateValues.mock.calls[0][1];
    expect(updatesArg).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ range: 'TimeTracker!B1' }),
        expect.objectContaining({ range: 'TimeTracker!E1' }),
      ]),
    );
  });
});

describe('handleDeleteSyncedSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifySupabaseJwt.mockResolvedValue({
      userId: 'user-1',
      raw: {},
    });
    mocks.getConnectionByUser.mockResolvedValue({
      id: 'conn-1',
      user_id: 'user-1',
      google_user_id: 'google-1',
      spreadsheet_id: 'sheet-spreadsheet',
      sheet_id: 42,
      sheet_title: 'TimeTracker',
      access_token: 'g-access',
      refresh_token: 'g-refresh',
      access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mocks.getColumnMappingByConnection.mockResolvedValue({
      id: 'mapping-1',
      connection_id: 'conn-1',
      mappings: {
        id: 'A',
        status: 'B',
        title: 'C',
        startedAt: 'D',
        endedAt: 'E',
        durationSeconds: 'F',
      },
      required_columns: [],
      optional_columns: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mocks.deleteRows.mockResolvedValue(undefined);
    mocks.findSyncLog.mockResolvedValue({
      id: 'log-1',
      connection_id: 'conn-1',
      session_id: 'session-1',
      status: 'success',
      attempted_at: new Date().toISOString(),
      failure_reason: null,
      google_append_request: null,
      google_append_response: null,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mocks.updateSyncLog.mockResolvedValue({
      id: 'log-1',
      connection_id: 'conn-1',
      session_id: 'session-1',
      status: 'success',
      attempted_at: new Date().toISOString(),
      failure_reason: null,
      google_append_request: null,
      google_append_response: { action: 'deleted' },
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mocks.getRange.mockResolvedValue({ values: [['session-1'], ['session-2']] });
  });

  it('returns 401 when authorization header is missing', async () => {
    const response = await handleDeleteSyncedSession(
      buildDeleteRequest({ sessionId: 'session-1' }),
      env,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'unauthorized',
    });
  });

  it('deletes the row and updates the sync log when found', async () => {
    const response = await handleDeleteSyncedSession(
      buildDeleteRequest({ sessionId: 'session-1' }, 'token-123'),
      env,
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
    expect(mocks.deleteRows).toHaveBeenCalledWith('sheet-spreadsheet', 42, 0, 1);
    expect(mocks.updateSyncLog).toHaveBeenCalledWith(
      env,
      'log-1',
      expect.objectContaining({
        status: 'success',
      }),
    );
  });

  it('returns skipped when the row cannot be found', async () => {
    mocks.getRange.mockResolvedValue({ values: [['session-x']] });

    const response = await handleDeleteSyncedSession(
      buildDeleteRequest({ sessionId: 'session-1' }, 'token-123'),
      env,
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ status: 'skipped' });
    expect(mocks.deleteRows).not.toHaveBeenCalled();
  });
});
