import type { Env } from '../env';
import {
  extractBearerToken,
  verifySupabaseJwt,
  SupabaseAuthError,
} from '../auth/verifySupabaseJwt';
import {
  getConnectionByUser,
  upsertConnection,
  updateAccessToken,
  SupabaseRepositoryError,
} from '../repositories/googleConnections';
import {
  jsonResponse,
  badRequest,
  unauthorized,
  conflict,
  serverError,
} from '../http/response';

type OauthStatePayload = {
  userId: string;
  redirectPath: string;
  nonce: string;
};

const GOOGLE_AUTH_ENDPOINT =
  'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

const DEFAULT_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
];

const toBase64Url = (input: string): string => {
  if (typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
  }
  return Buffer.from(input, 'utf8').toString('base64url');
};

const fromBase64Url = (value: string): string => {
  if (typeof atob === 'function') {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(value, 'base64url').toString('utf8');
};

const encodeState = (payload: OauthStatePayload): string =>
  toBase64Url(JSON.stringify(payload));

const decodeState = (value: string): OauthStatePayload => {
  try {
    const json = fromBase64Url(value);
    const parsed = JSON.parse(json) as Partial<OauthStatePayload>;
    if (
      !parsed ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.redirectPath !== 'string' ||
      typeof parsed.nonce !== 'string'
    ) {
      throw new Error('Invalid state payload');
    }
    return parsed as OauthStatePayload;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Invalid state payload',
    );
  }
};

const ensureEnv = (env: Env) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error('Google OAuth environment variables are not configured');
  }
};

const getAuthorizationUrl = (
  env: Env,
  state: OauthStatePayload,
  redirectPath: string,
): string => {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('scope', DEFAULT_SCOPES.join(' '));
  url.searchParams.set('state', encodeState({ ...state, redirectPath }));
  return url.toString();
};

const extractJwtPayload = (token: string | null | undefined) => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = fromBase64Url(parts[1] ?? '');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const parseTokenResponse = async (response: Response) => {
  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    throw new Error(
      `Failed to exchange authorization code: ${response.status} ${JSON.stringify(detail)}`,
    );
  }
  return (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
    token_type?: string;
  };
};


/**
 * リフレッシュトークンを使って新しいアクセストークンを取得
 */
export const refreshAccessToken = async (
  env: Env,
  refreshToken: string,
): Promise<{
  accessToken: string;
  expiresAt: string;
}> => {
  ensureEnv(env);

  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const tokenPayload = await parseTokenResponse(tokenResponse);
  const accessToken = tokenPayload.access_token;
  if (!accessToken) {
    throw new Error('Missing access_token from refresh response');
  }

  const expiresAt = new Date(
    Date.now() + (typeof tokenPayload.expires_in === 'number' ? tokenPayload.expires_in * 1000 : 3600000),
  ).toISOString();

  return { accessToken, expiresAt };
};


/**
 * アクセストークンが期限切れかチェックし、必要ならリフレッシュ
 * 更新した場合はDBも更新する
 */
export const ensureValidAccessToken = async (
  env: Env,
  connection: {
    id: string;
    access_token: string;
    refresh_token: string;
    access_token_expires_at: string;
  },
): Promise<string> => {
  const expiresAt = new Date(connection.access_token_expires_at);
  const now = new Date();

  // 有効期限の5分前にリフレッシュ（余裕を持たせる）
  const bufferMs = 5 * 60 * 1000;
  const needsRefresh = expiresAt.getTime() - now.getTime() < bufferMs;

  if (!needsRefresh) {
    return connection.access_token;
  }

  // トークンをリフレッシュ
  const { accessToken, expiresAt: newExpiresAt } = await refreshAccessToken(
    env,
    connection.refresh_token,
  );

  // DBを更新
  await updateAccessToken(env, connection.id, accessToken, newExpiresAt);

  return accessToken;
};

export const handleOauthStart = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  const origin = request.headers.get('Origin');
  const token = extractBearerToken(request);
  if (!token) {
    return unauthorized('Bearer token is required', origin);
  }

  let payload: { redirectPath?: unknown };
  try {
    payload = (await request.json()) as { redirectPath?: unknown };
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Invalid request body');
  }

  if (typeof payload.redirectPath !== 'string' || payload.redirectPath.trim().length === 0) {
    return badRequest('redirectPath is required');
  }

  try {
    ensureEnv(env);
  } catch (error) {
    return serverError(
      error instanceof Error ? error.message : 'Missing Google OAuth configuration',
      500,
    );
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

  const state: OauthStatePayload = {
    userId: auth.userId,
    redirectPath: payload.redirectPath,
    nonce:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
  };

  const authorizationUrl = getAuthorizationUrl(env, state, payload.redirectPath);

  return jsonResponse({ authorizationUrl });
};

export const handleOauthCallback = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateValue = url.searchParams.get('state');
  if (!code || !stateValue) {
    return badRequest('code and state are required');
  }

  let state: OauthStatePayload;
  try {
    state = decodeState(stateValue);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Invalid state');
  }

  try {
    ensureEnv(env);
  } catch (error) {
    return serverError(
      error instanceof Error ? error.message : 'Missing Google OAuth configuration',
      500,
    );
  }

  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  let tokenPayload;
  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    tokenPayload = await parseTokenResponse(tokenResponse);
  } catch (error) {
    return serverError(
      error instanceof Error ? error.message : 'Failed to exchange authorization code',
      502,
    );
  }

  const accessToken = tokenPayload.access_token;
  const refreshToken = tokenPayload.refresh_token;
  if (!accessToken || !refreshToken) {
    return serverError('Missing Google OAuth tokens from response', 502);
  }

  const scopes = tokenPayload.scope
    ? tokenPayload.scope.split(/\s+/u).filter(Boolean)
    : DEFAULT_SCOPES;
  const expiresAt = new Date(
    Date.now() + (typeof tokenPayload.expires_in === 'number' ? tokenPayload.expires_in * 1000 : 0),
  ).toISOString();

  let connection;
  try {
    connection = await getConnectionByUser(env, state.userId);
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return serverError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }

  const idTokenPayload = extractJwtPayload(tokenPayload.id_token);
  const googleUserId =
    (idTokenPayload?.sub as string | undefined) ??
    connection?.google_user_id ??
    'unknown-google-user';

  try {
    await upsertConnection(env, {
      userId: state.userId,
      googleUserId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt: expiresAt,
      scopes,
      status: 'active',
    });
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return serverError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: state.redirectPath,
    },
  });
};

export const handleOauthRevoke = async (
  request: Request,
  env: Env,
): Promise<Response> => {
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
    return new Response(null, { status: 204 });
  }

  try {
    await fetch(GOOGLE_REVOKE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: connection.access_token,
      }),
    });
  } catch (error) {
    return serverError(
      error instanceof Error ? error.message : 'Failed to revoke Google tokens',
      502,
    );
  }

  try {
    await upsertConnection(env, {
      userId: auth.userId,
      googleUserId: connection.google_user_id,
      accessToken: '',
      refreshToken: '',
      accessTokenExpiresAt: new Date().toISOString(),
      scopes: connection.scopes ?? DEFAULT_SCOPES,
      status: 'revoked',
    });
  } catch (error) {
    if (error instanceof SupabaseRepositoryError) {
      return serverError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }

  return new Response(null, { status: 204 });
};
