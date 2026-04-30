import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '../../security/tokenCrypto';
import {
  type GoogleSpreadsheetConnectionRow,
  getConnectionByUser,
  updateAccessToken,
  upsertConnection,
} from '../googleConnections';

const env = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  GOOGLE_CLIENT_ID: 'client-123',
  GOOGLE_CLIENT_SECRET: 'secret-xyz',
  GOOGLE_REDIRECT_URI: 'https://worker.example.com/oauth/callback',
  TOKEN_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
} as const;

const ACCESS_TOKEN_AAD = 'google_spreadsheet_connections.access_token';
const REFRESH_TOKEN_AAD = 'google_spreadsheet_connections.refresh_token';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

const connectionRow = (
  overrides: Partial<GoogleSpreadsheetConnectionRow> = {},
): GoogleSpreadsheetConnectionRow => ({
  id: 'conn-1',
  user_id: 'user-1',
  google_user_id: 'google-user-1',
  spreadsheet_id: 'spreadsheet-1',
  sheet_id: 0,
  sheet_title: 'Sheet1',
  access_token: 'access',
  refresh_token: 'refresh',
  access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('google connections repository token handling', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('encrypts Google tokens before storing a connection', async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    fetchMock.mockImplementationOnce(async (_url: string, init: RequestInit) => {
      const requestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
      requestBodies.push(requestBody);
      return jsonResponse([
        connectionRow({
          access_token: String(requestBody.access_token),
          refresh_token: String(requestBody.refresh_token),
        }),
      ]);
    });

    const row = await upsertConnection(env, {
      userId: 'user-1',
      googleUserId: 'google-user-1',
      accessToken: 'google-access-token',
      refreshToken: 'google-refresh-token',
      accessTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      status: 'active',
    });
    const storedBody = requestBodies[0];
    if (!storedBody) {
      throw new Error('Missing stored request body');
    }

    expect(storedBody.access_token).toMatch(/^enc:v1:/u);
    expect(storedBody.refresh_token).toMatch(/^enc:v1:/u);
    expect(storedBody.access_token).not.toBe('google-access-token');
    expect(storedBody.refresh_token).not.toBe('google-refresh-token');
    expect(row.access_token).toBe('google-access-token');
    expect(row.refresh_token).toBe('google-refresh-token');
  });

  it('decrypts encrypted Google tokens when loading a connection', async () => {
    const accessToken = await encryptSecret(
      'google-access-token',
      env.TOKEN_ENCRYPTION_KEY,
      ACCESS_TOKEN_AAD,
    );
    const refreshToken = await encryptSecret(
      'google-refresh-token',
      env.TOKEN_ENCRYPTION_KEY,
      REFRESH_TOKEN_AAD,
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        connectionRow({
          access_token: accessToken,
          refresh_token: refreshToken,
        }),
      ]),
    );

    const row = await getConnectionByUser(env, 'user-1');

    expect(row?.access_token).toBe('google-access-token');
    expect(row?.refresh_token).toBe('google-refresh-token');
  });

  it('encrypts refreshed access and refresh tokens when patching a connection', async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    fetchMock.mockImplementationOnce(async (_url: string, init: RequestInit) => {
      requestBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response(null, { status: 204 });
    });

    await updateAccessToken(
      env,
      'conn-1',
      'new-google-access-token',
      new Date(Date.now() + 3600_000).toISOString(),
      'existing-google-refresh-token',
    );

    const storedBody = requestBodies[0];
    if (!storedBody) {
      throw new Error('Missing stored request body');
    }

    expect(storedBody.access_token).toMatch(/^enc:v1:/u);
    expect(storedBody.refresh_token).toMatch(/^enc:v1:/u);
    expect(storedBody.access_token).not.toBe('new-google-access-token');
    expect(storedBody.refresh_token).not.toBe('existing-google-refresh-token');
  });

  it('keeps legacy plaintext rows readable during migration', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        connectionRow({
          access_token: 'legacy-access-token',
          refresh_token: 'legacy-refresh-token',
        }),
      ]),
    );

    const row = await getConnectionByUser(
      {
        ...env,
        TOKEN_ENCRYPTION_KEY: undefined,
      },
      'user-1',
    );

    expect(row?.access_token).toBe('legacy-access-token');
    expect(row?.refresh_token).toBe('legacy-refresh-token');
  });
});
