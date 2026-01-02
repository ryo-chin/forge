import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOauthStart, handleOauthCallback, handleOauthRevoke } from '../oauth';

const env = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  GOOGLE_CLIENT_ID: 'client-123',
  GOOGLE_CLIENT_SECRET: 'secret-xyz',
  GOOGLE_REDIRECT_URI: 'https://worker.example.com/oauth/callback',
} as const;

const buildRequest = (
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
) =>
  new Request(url, {
    method: init.method ?? 'GET',
    headers: init.headers ?? {},
    body:
      init.body === undefined
        ? undefined
        : typeof init.body === 'string'
          ? init.body
          : JSON.stringify(init.body),
  });

const mocks = vi.hoisted(() => {
  const verifySupabaseJwt = vi.fn();
  const upsertConnection = vi.fn();
  const getConnectionByUser = vi.fn();
  return {
    verifySupabaseJwt,
    upsertConnection,
    getConnectionByUser,
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
    upsertConnection: mocks.upsertConnection,
    getConnectionByUser: mocks.getConnectionByUser,
  };
});

describe('oauth handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleOauthStart', () => {
    it('requires bearer token', async () => {
      const response = await handleOauthStart(
        buildRequest('https://example.com/integrations/google/oauth/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { redirectPath: '/app' },
        }),
        env,
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        error: 'unauthorized',
      });
    });

    it('returns authorization url with state', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });

      const response = await handleOauthStart(
        buildRequest('https://example.com/integrations/google/oauth/start', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer token-123',
            'Content-Type': 'application/json',
          },
          body: { redirectPath: '/app/dashboard' },
        }),
        env,
      );

      expect(response.status).toBe(200);
      const payload = (await response.json()) as { authorizationUrl: string };
      expect(payload.authorizationUrl).toBeTypeOf('string');
      const url = new URL(payload.authorizationUrl);
      expect(url.origin).toBe('https://accounts.google.com');
      expect(url.searchParams.get('client_id')).toBe(env.GOOGLE_CLIENT_ID);
      expect(url.searchParams.get('redirect_uri')).toBe(env.GOOGLE_REDIRECT_URI);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toBe('consent');
      const scopes = url.searchParams.get('scope');
      expect(scopes).toContain('https://www.googleapis.com/auth/spreadsheets');
      const state = url.searchParams.get('state');
      expect(state).toBeTruthy();
      const decoded = JSON.parse(Buffer.from(state ?? '', 'base64url').toString('utf8')) as {
        userId: string;
        redirectPath: string;
        nonce: string;
      };
      expect(decoded.userId).toBe('user-1');
      expect(decoded.redirectPath).toBe('/app/dashboard');
      expect(typeof decoded.nonce).toBe('string');
    });
  });

  describe('handleOauthCallback', () => {
    it('exchanges code and stores connection', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });
      const state = Buffer.from(
        JSON.stringify({
          userId: 'user-1',
          redirectPath: '/app/dashboard',
          nonce: 'abc123',
        }),
        'utf8',
      ).toString('base64url');

      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: 'google-user-1', email: 'user@example.com' }),
      ).toString('base64url');
      const tokenResponse = {
        access_token: 'google-access',
        refresh_token: 'google-refresh',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        token_type: 'Bearer',
        id_token: `${header}.${payload}.signature`,
      };
      (fetch as unknown as vi.Mock).mockResolvedValue(
        new Response(JSON.stringify(tokenResponse), { status: 200 }),
      );

      const request = buildRequest(
        `https://example.com/integrations/google/oauth/callback?code=auth-code&state=${state}`,
        {
          headers: { Authorization: 'Bearer token-123' },
        },
      );

      const response = await handleOauthCallback(request, env);

      expect(fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(mocks.upsertConnection).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          userId: 'user-1',
          googleUserId: 'google-user-1',
          accessToken: 'google-access',
          refreshToken: 'google-refresh',
          status: 'active',
        }),
      );
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/app/dashboard');
    });
  });

  describe('handleOauthRevoke', () => {
    it('revokes connection when exists', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });
      mocks.getConnectionByUser.mockResolvedValue({
        id: 'conn-1',
        user_id: 'user-1',
        google_user_id: 'google-abc',
        spreadsheet_id: 'spreadsheet-1',
        sheet_id: 1,
        sheet_title: 'Sheet1',
        access_token: 'access',
        refresh_token: 'refresh',
        access_token_expires_at: new Date().toISOString(),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      (fetch as unknown as vi.Mock).mockResolvedValue(new Response(null, { status: 200 }));

      const response = await handleOauthRevoke(
        buildRequest('https://example.com/integrations/google/oauth/revoke', {
          method: 'POST',
          headers: { Authorization: 'Bearer token-123' },
        }),
        env,
      );

      expect(fetch).toHaveBeenCalled();
      expect(mocks.upsertConnection).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          userId: 'user-1',
          status: 'revoked',
        }),
      );
      expect(response.status).toBe(204);
    });
  });
});
