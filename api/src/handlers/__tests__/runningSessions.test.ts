import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  handleRunningSessionStart,
  handleRunningSessionUpdate,
  handleRunningSessionCancel,
} from '../runningSessions';

const mocks = vi.hoisted(() => {
  const verifySupabaseJwt = vi.fn();
  const getConnectionByUser = vi.fn();
  const getColumnMappingByConnection = vi.fn();
  const ensureValidAccessToken = vi.fn();
  const appendRow = vi.fn();
  const getRange = vi.fn();
  const batchUpdateValues = vi.fn();
  return {
    verifySupabaseJwt,
    getConnectionByUser,
    getColumnMappingByConnection,
    ensureValidAccessToken,
    appendRow,
    getRange,
    batchUpdateValues,
  };
});

vi.mock('../../auth/verifySupabaseJwt', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../auth/verifySupabaseJwt')
  >();
  return {
    ...actual,
    verifySupabaseJwt: mocks.verifySupabaseJwt,
  };
});

vi.mock('../../repositories/googleConnections', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../repositories/googleConnections')>();
  return {
    ...actual,
    getConnectionByUser: mocks.getConnectionByUser,
    getColumnMappingByConnection: mocks.getColumnMappingByConnection,
  };
});

vi.mock('../oauth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../oauth')>();
  return {
    ...actual,
    ensureValidAccessToken: mocks.ensureValidAccessToken,
  };
});

vi.mock('../../services/googleSheetsClient', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/googleSheetsClient')>();
  return {
    ...actual,
    GoogleSheetsClient: {
      ...actual.GoogleSheetsClient,
      fromAccessToken: vi.fn(() => ({
        appendRow: mocks.appendRow,
        getRange: mocks.getRange,
        batchUpdateValues: mocks.batchUpdateValues,
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

const buildStartRequest = (body: unknown) =>
  new Request('https://example.com/integrations/google/running/start', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer supabase-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

const buildUpdateRequest = (body: unknown) =>
  new Request('https://example.com/integrations/google/running/update', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer supabase-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

const buildCancelRequest = (body: unknown) =>
  new Request('https://example.com/integrations/google/running/cancel', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer supabase-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

const prepareConnectionMocks = () => {
  mocks.verifySupabaseJwt.mockResolvedValue({
    userId: 'user-1',
    raw: {},
  });
  mocks.getConnectionByUser.mockResolvedValue({
    id: 'conn-1',
    user_id: 'user-1',
    google_user_id: 'google-1',
    spreadsheet_id: 'spreadsheet-1',
    sheet_id: 1,
    sheet_title: 'Sessions',
    access_token: 'token',
    refresh_token: 'refresh',
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
  mocks.ensureValidAccessToken.mockResolvedValue('google-access-token');
};

describe('handleRunningSessionStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareConnectionMocks();
  });

  it('appends a running session row', async () => {
    const response = await handleRunningSessionStart(
      buildStartRequest({
        draft: {
          id: 'session-1',
          title: 'Focus',
          startedAt: '2025-10-12T12:00:00.000Z',
          project: 'Project',
        },
      }),
      env,
    );

    expect(response.status).toBe(202);
    expect(mocks.appendRow).toHaveBeenCalledTimes(1);
    const values = mocks.appendRow.mock.calls[0][2];
    expect(values).toEqual(
      expect.arrayContaining(['session-1', 'Running', 'Focus']),
    );
  });
});

describe('handleRunningSessionCancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareConnectionMocks();
    mocks.getRange.mockResolvedValue({
      values: [['session-1'], ['session-2']],
    });
  });

  it('clears the running session row when found', async () => {
    const response = await handleRunningSessionCancel(
      buildCancelRequest({ id: 'session-1' }),
      env,
    );

    expect(response.status).toBe(202);
    expect(mocks.batchUpdateValues).toHaveBeenCalledTimes(1);
    const updates = mocks.batchUpdateValues.mock.calls[0][1];
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ range: 'Sessions!A1', values: [['']] }),
        expect.objectContaining({ range: 'Sessions!B1', values: [['']] }),
      ]),
    );
  });

  it('returns skipped status when row is not found', async () => {
    mocks.getRange.mockResolvedValue({ values: [['session-x']] });

    const response = await handleRunningSessionCancel(
      buildCancelRequest({ id: 'session-1' }),
      env,
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ status: 'skipped' });
    expect(mocks.batchUpdateValues).not.toHaveBeenCalled();
  });
});

describe('handleRunningSessionUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareConnectionMocks();
    mocks.getRange.mockResolvedValue({ values: [['session-1'], ['session-2']] });
  });

  it('updates running session fields when row exists', async () => {
    const response = await handleRunningSessionUpdate(
      buildUpdateRequest({
        draft: {
          id: 'session-1',
          title: 'Deep Work',
          startedAt: '2025-10-12T12:00:00.000Z',
          project: 'Project',
          tags: ['tag1', 'tag2'],
        },
        elapsedSeconds: 120,
      }),
      env,
    );

    expect(response.status).toBe(202);
    expect(mocks.batchUpdateValues).toHaveBeenCalledTimes(1);
    const updates = mocks.batchUpdateValues.mock.calls[0][1];
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ range: 'Sessions!B1' }),
        expect.objectContaining({ range: 'Sessions!D1' }),
        expect.objectContaining({ range: 'Sessions!F1', values: [[120]] }),
      ]),
    );
  });

  it('returns conflict when row is not found', async () => {
    mocks.getRange.mockResolvedValue({ values: [['session-x']] });

    const response = await handleRunningSessionUpdate(
      buildUpdateRequest({
        draft: {
          id: 'session-1',
          title: 'Deep Work',
          startedAt: '2025-10-12T12:00:00.000Z',
        },
        elapsedSeconds: 60,
      }),
      env,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'row_not_found',
    });
  });
});
