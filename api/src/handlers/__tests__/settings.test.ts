import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleGetSettings,
  handleUpdateSettings,
  handleListSpreadsheets,
  handleListSheets,
} from '../settings';

const env = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  GOOGLE_REDIRECT_URI: '',
} as const;

const buildRequest = (
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
  token = 'token-123',
) => {
  const url = new URL('https://example.com/integrations/google/settings');
  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url.toString(), {
    method: init.method ?? 'GET',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
        },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
};

const mocks = vi.hoisted(() => {
  const verifySupabaseJwt = vi.fn();
  const getConnectionByUser = vi.fn();
  const getColumnMappingByConnection = vi.fn();
  const updateConnectionSelection = vi.fn();
  const saveColumnMapping = vi.fn();
  const listSpreadsheets = vi.fn();
  const listSheets = vi.fn();
  return {
    verifySupabaseJwt,
    getConnectionByUser,
    getColumnMappingByConnection,
    updateConnectionSelection,
    saveColumnMapping,
    listSpreadsheets,
    listSheets,
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
    updateConnectionSelection: mocks.updateConnectionSelection,
    saveColumnMapping: mocks.saveColumnMapping,
  };
});

vi.mock('../../services/googleSheetsClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/googleSheetsClient')>();
  return {
    ...actual,
    GoogleSheetsClient: {
      ...actual.GoogleSheetsClient,
      fromAccessToken: vi.fn(() => ({
        listSpreadsheets: mocks.listSpreadsheets,
        getSpreadsheetSheets: mocks.listSheets,
      })),
    },
  };
});

vi.mock('../oauth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../oauth')>();
  return {
    ...actual,
    ensureValidAccessToken: vi
      .fn()
      .mockImplementation(async (_env, connection) => connection.access_token),
  };
});

describe('settings handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleGetSettings', () => {
    it('returns default state when connection is missing', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });
      mocks.getConnectionByUser.mockResolvedValue(null);

      const response = await handleGetSettings(buildRequest(), env);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        connectionStatus: 'revoked',
        spreadsheet: null,
        columnMapping: null,
      });
    });

    it('returns connection and mapping data', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });
      mocks.getConnectionByUser.mockResolvedValue({
        id: 'conn-1',
        user_id: 'user-1',
        google_user_id: 'google-1',
        spreadsheet_id: 'spreadsheet-1',
        sheet_id: 1,
        sheet_title: 'Sheet1',
        access_token: 'access',
        refresh_token: 'refresh',
        access_token_expires_at: new Date().toISOString(),
        scopes: ['scope'],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mocks.getColumnMappingByConnection.mockResolvedValue({
        id: 'map-1',
        connection_id: 'conn-1',
        mappings: { title: 'A', startedAt: 'B', endedAt: 'C', durationSeconds: 'D' },
        required_columns: ['title', 'startedAt', 'endedAt', 'durationSeconds'],
        optional_columns: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const response = await handleGetSettings(buildRequest(), env);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        connectionStatus: 'active',
        spreadsheet: {
          id: 'spreadsheet-1',
          sheetId: 1,
          sheetTitle: 'Sheet1',
        },
        columnMapping: {
          mappings: expect.objectContaining({ title: 'A' }),
        },
      });
      expect(mocks.getColumnMappingByConnection).toHaveBeenCalledWith(env, 'conn-1');
    });
  });

  describe('handleUpdateSettings', () => {
    it('updates spreadsheet selection and mapping', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });
      mocks.getConnectionByUser.mockResolvedValue({
        id: 'conn-1',
        user_id: 'user-1',
        google_user_id: 'google-1',
        spreadsheet_id: null,
        sheet_id: null,
        sheet_title: null,
        access_token: 'access',
        refresh_token: 'refresh',
        access_token_expires_at: new Date().toISOString(),
        scopes: ['scope'],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mocks.updateConnectionSelection.mockResolvedValue({
        id: 'conn-1',
        user_id: 'user-1',
        google_user_id: 'google-1',
        spreadsheet_id: 'spreadsheet-99',
        sheet_id: 3,
        sheet_title: 'Sheet3',
        access_token: 'access',
        refresh_token: 'refresh',
        access_token_expires_at: new Date().toISOString(),
        scopes: ['scope'],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mocks.getColumnMappingByConnection.mockResolvedValue({
        id: 'map-1',
        connection_id: 'conn-1',
        mappings: { title: 'A', startedAt: 'B', endedAt: 'C', durationSeconds: 'D' },
        required_columns: ['title', 'startedAt', 'endedAt', 'durationSeconds'],
        optional_columns: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mocks.saveColumnMapping.mockResolvedValue({
        id: 'map-1',
        connection_id: 'conn-1',
        mappings: { title: 'A' },
        required_columns: ['title'],
        optional_columns: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const response = await handleUpdateSettings(
        buildRequest(
          {
            method: 'PUT',
            body: {
              spreadsheetId: 'spreadsheet-99',
              sheetId: 3,
              sheetTitle: 'Sheet3',
              columnMapping: {
                title: 'A',
                startedAt: 'B',
                endedAt: 'C',
                durationSeconds: 'D',
              },
            },
          },
          'token-123',
        ),
        env,
      );

      expect(response.status).toBe(200);
      expect(mocks.updateConnectionSelection).toHaveBeenCalledWith(
        env,
        'user-1',
        expect.objectContaining({
          spreadsheetId: 'spreadsheet-99',
          sheetId: 3,
          sheetTitle: 'Sheet3',
        }),
      );
      expect(mocks.saveColumnMapping).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          connectionId: 'conn-1',
          mappings: expect.objectContaining({ title: 'A' }),
        }),
      );
    });
  });

  describe('handleListSpreadsheets', () => {
    it('returns spreadsheet list', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });
      mocks.getConnectionByUser.mockResolvedValue({
        id: 'conn-1',
        user_id: 'user-1',
        google_user_id: 'google-1',
        spreadsheet_id: null,
        sheet_id: null,
        sheet_title: null,
        access_token: 'access-token',
        refresh_token: 'refresh',
        access_token_expires_at: new Date().toISOString(),
        scopes: ['scope'],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mocks.listSpreadsheets.mockResolvedValue({
        items: [
          {
            id: 'spreadsheet-1',
            name: 'Sheet One',
            url: 'https://docs.google.com/spreadsheets/d/spreadsheet-1',
          },
        ],
        nextPageToken: 'token',
      });

      const response = await handleListSpreadsheets(buildRequest({ query: { q: 'Sheet' } }), env);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        items: [
          {
            id: 'spreadsheet-1',
            name: 'Sheet One',
          },
        ],
        nextPageToken: 'token',
      });
      expect(mocks.listSpreadsheets).toHaveBeenCalledWith('Sheet');
    });
  });

  describe('handleListSheets', () => {
    it('returns sheet list for spreadsheet', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });
      mocks.getConnectionByUser.mockResolvedValue({
        id: 'conn-1',
        user_id: 'user-1',
        google_user_id: 'google-1',
        spreadsheet_id: null,
        sheet_id: null,
        sheet_title: null,
        access_token: 'access-token',
        refresh_token: 'refresh',
        access_token_expires_at: new Date().toISOString(),
        scopes: ['scope'],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mocks.listSheets.mockResolvedValue([
        { sheetId: 1, title: 'Sheet1', index: 0 },
        { sheetId: 2, title: 'Sheet2', index: 1 },
      ]);

      const request = new Request(
        'https://example.com/integrations/google/spreadsheets/spreadsheet-1/sheets',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer token-123' },
        },
      );

      const response = await handleListSheets(request, env);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        items: [
          { sheetId: 1, title: 'Sheet1' },
          { sheetId: 2, title: 'Sheet2' },
        ],
      });
      expect(mocks.listSheets).toHaveBeenCalledWith('spreadsheet-1');
    });
  });
});
