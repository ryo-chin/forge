import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { handleOauthCallback, handleOauthRevoke, handleOauthStart } from '../oauth';

const env = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  GOOGLE_CLIENT_ID: 'client-123',
  GOOGLE_CLIENT_SECRET: 'secret-xyz',
  GOOGLE_REDIRECT_URI: 'https://worker.example.com/oauth/callback',
  OAUTH_STATE_SIGNING_SECRET: 'state-signing-secret-for-tests-32b',
  TOKEN_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
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

const extractStateFromStartResponse = async (response: Response): Promise<string> => {
  const payload = (await response.json()) as { authorizationUrl: string };
  const url = new URL(payload.authorizationUrl);
  const state = url.searchParams.get('state');
  if (!state) {
    throw new Error('Missing state');
  }
  return state;
};

const decodeSignedStatePayload = (
  state: string,
): {
  userId: string;
  redirectOrigin: string;
  redirectPath: string;
  nonce: string;
  exp: number;
} => {
  const [encodedPayload] = state.split('.');
  return JSON.parse(Buffer.from(encodedPayload ?? '', 'base64url').toString('utf8')) as {
    userId: string;
    redirectOrigin: string;
    redirectPath: string;
    nonce: string;
    exp: number;
  };
};

const tamperStateUserId = (state: string, userId: string): string => {
  const [encodedPayload, signature] = state.split('.');
  const payload = JSON.parse(Buffer.from(encodedPayload ?? '', 'base64url').toString('utf8')) as {
    userId: string;
  };
  const tamperedPayload = Buffer.from(
    JSON.stringify({
      ...payload,
      userId,
    }),
    'utf8',
  ).toString('base64url');
  return `${tamperedPayload}.${signature}`;
};

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
      expect(state?.split('.')).toHaveLength(2);
      const decoded = decodeSignedStatePayload(state ?? '');
      expect(decoded.userId).toBe('user-1');
      expect(decoded.redirectOrigin).toBe('https://forge.h031203yama.workers.dev');
      expect(decoded.redirectPath).toBe('/app/dashboard');
      expect(typeof decoded.nonce).toBe('string');
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('rejects absolute redirect paths', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });

      const response = await handleOauthStart(
        buildRequest('https://example.com/integrations/google/oauth/start', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer token-123',
            'Content-Type': 'application/json',
          },
          body: { redirectPath: 'https://evil.example/callback' },
        }),
        env,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: 'bad_request',
      });
    });
  });

  describe('handleOauthCallback', () => {
    it('exchanges code and stores connection', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });
      const startResponse = await handleOauthStart(
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
      const state = await extractStateFromStartResponse(startResponse);

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
      (fetch as unknown as Mock).mockResolvedValue(
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
      expect(response.headers.get('Location')).toBe(
        'https://forge.h031203yama.workers.dev/app/dashboard',
      );
    });

    it('redirects back to the allowed app origin from the signed state', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });
      const startResponse = await handleOauthStart(
        buildRequest('https://example.com/integrations/google/oauth/start', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer token-123',
            'Content-Type': 'application/json',
            Origin: 'http://localhost:5173',
          },
          body: { redirectPath: '/settings?tab=google#connect' },
        }),
        env,
      );
      const state = await extractStateFromStartResponse(startResponse);

      const tokenResponse = {
        access_token: 'google-access',
        refresh_token: 'google-refresh',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        token_type: 'Bearer',
      };
      (fetch as unknown as Mock).mockResolvedValue(
        new Response(JSON.stringify(tokenResponse), { status: 200 }),
      );

      const response = await handleOauthCallback(
        buildRequest(
          `https://example.com/integrations/google/oauth/callback?code=auth-code&state=${state}`,
        ),
        env,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(
        'http://localhost:5173/settings?tab=google#connect',
      );
    });

    it('rejects tampered state before exchanging the authorization code', async () => {
      mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });
      const startResponse = await handleOauthStart(
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
      const state = tamperStateUserId(await extractStateFromStartResponse(startResponse), 'user-2');

      const response = await handleOauthCallback(
        buildRequest(
          `https://example.com/integrations/google/oauth/callback?code=auth-code&state=${state}`,
        ),
        env,
      );

      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
      expect(mocks.upsertConnection).not.toHaveBeenCalled();
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
      (fetch as unknown as Mock).mockResolvedValue(new Response(null, { status: 200 }));

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
