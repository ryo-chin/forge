import {
  extractBearerToken,
  SupabaseAuthError,
  verifySupabaseJwt,
} from '../auth/verifySupabaseJwt';
import type { Env } from '../env';
import {
  badRequest,
  jsonResponse,
  resolveAllowedOrigin,
  serverError,
  unauthorized,
} from '../http/response';
import {
  getConnectionByUser,
  SupabaseRepositoryError,
  updateAccessToken,
  upsertConnection,
} from '../repositories/googleConnections';

type OauthStatePayload = {
  userId: string;
  redirectOrigin: string;
  redirectPath: string;
  nonce: string;
};

type SignedOauthStatePayload = OauthStatePayload & {
  exp: number;
};

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const DEFAULT_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
];

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
};

const base64UrlToBytes = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const toBase64Url = (input: string): string => {
  if (typeof btoa === 'function') {
    return bytesToBase64Url(new TextEncoder().encode(input));
  }
  return Buffer.from(input, 'utf8').toString('base64url');
};

const fromBase64Url = (value: string): string => {
  if (typeof atob === 'function') {
    return new TextDecoder().decode(base64UrlToBytes(value));
  }
  return Buffer.from(value, 'base64url').toString('utf8');
};

const stateSigningSecret = (env: Env): string => {
  if (!env.OAUTH_STATE_SIGNING_SECRET || env.OAUTH_STATE_SIGNING_SECRET.trim().length === 0) {
    throw new Error('OAuth state signing secret is not configured');
  }
  if (new TextEncoder().encode(env.OAUTH_STATE_SIGNING_SECRET).byteLength < 32) {
    throw new Error('OAuth state signing secret must be at least 32 bytes');
  }
  return env.OAUTH_STATE_SIGNING_SECRET;
};

const importStateSigningKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );

const signStatePayload = async (encodedPayload: string, secret: string): Promise<string> => {
  const key = await importStateSigningKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return bytesToBase64Url(new Uint8Array(signature));
};

const verifyStateSignature = async (
  encodedPayload: string,
  encodedSignature: string,
  secret: string,
): Promise<boolean> => {
  const key = await importStateSigningKey(secret);
  return crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(encodedPayload),
  );
};

const buildNonce = (): string => {
  const randomUUID = globalThis.crypto.randomUUID;
  if (typeof randomUUID === 'function') {
    return randomUUID.call(globalThis.crypto);
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
};

const encodeState = async (payload: OauthStatePayload, env: Env): Promise<string> => {
  const signedPayload: SignedOauthStatePayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS,
  };
  const encodedPayload = toBase64Url(JSON.stringify(signedPayload));
  const signature = await signStatePayload(encodedPayload, stateSigningSecret(env));
  return `${encodedPayload}.${signature}`;
};

const decodeState = async (value: string, env: Env): Promise<OauthStatePayload> => {
  try {
    const [encodedPayload, encodedSignature, extra] = value.split('.');
    if (!encodedPayload || !encodedSignature || extra !== undefined) {
      throw new Error('Invalid state payload');
    }

    const verified = await verifyStateSignature(
      encodedPayload,
      encodedSignature,
      stateSigningSecret(env),
    );
    if (!verified) {
      throw new Error('Invalid state signature');
    }

    const json = fromBase64Url(encodedPayload);
    const parsed = JSON.parse(json) as Partial<SignedOauthStatePayload>;
    if (
      !parsed ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.redirectPath !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      throw new Error('Invalid state payload');
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Expired state');
    }
    return {
      userId: parsed.userId,
      redirectOrigin: resolveAllowedOrigin(
        typeof parsed.redirectOrigin === 'string' ? parsed.redirectOrigin : null,
      ),
      redirectPath: parsed.redirectPath,
      nonce: parsed.nonce,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid state payload');
  }
};

const ensureGoogleEnv = (env: Env) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error('Google OAuth environment variables are not configured');
  }
};

const ensureOauthFlowEnv = (env: Env) => {
  ensureGoogleEnv(env);
  stateSigningSecret(env);
  if (!env.TOKEN_ENCRYPTION_KEY || env.TOKEN_ENCRYPTION_KEY.trim().length === 0) {
    throw new Error('Token encryption key is not configured');
  }
};

const normalizeRedirectPath = (value: string): string | null => {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    /[\r\n]/u.test(trimmed)
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, 'https://forge.local');
    if (parsed.origin !== 'https://forge.local') {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

const getAuthorizationUrl = (env: Env, stateValue: string): string => {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('scope', DEFAULT_SCOPES.join(' '));
  url.searchParams.set('state', stateValue);
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
  ensureGoogleEnv(env);

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
    Date.now() +
      (typeof tokenPayload.expires_in === 'number' ? tokenPayload.expires_in * 1000 : 3600000),
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
  await updateAccessToken(env, connection.id, accessToken, newExpiresAt, connection.refresh_token);

  return accessToken;
};

export const handleOauthStart = async (request: Request, env: Env): Promise<Response> => {
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
  const redirectPath = normalizeRedirectPath(payload.redirectPath);
  if (!redirectPath) {
    return badRequest('redirectPath must be an app-relative path');
  }

  try {
    ensureOauthFlowEnv(env);
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
    redirectOrigin: resolveAllowedOrigin(origin),
    redirectPath,
    nonce: buildNonce(),
  };

  const stateValue = await encodeState(state, env);
  const authorizationUrl = getAuthorizationUrl(env, stateValue);

  return jsonResponse({ authorizationUrl });
};

export const handleOauthCallback = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateValue = url.searchParams.get('state');
  if (!code || !stateValue) {
    return badRequest('code and state are required');
  }

  try {
    ensureOauthFlowEnv(env);
  } catch (error) {
    return serverError(
      error instanceof Error ? error.message : 'Missing Google OAuth configuration',
      500,
    );
  }

  let state: OauthStatePayload;
  try {
    state = await decodeState(stateValue, env);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Invalid state');
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
      Location: new URL(state.redirectPath, state.redirectOrigin).toString(),
    },
  });
};

export const handleOauthRevoke = async (request: Request, env: Env): Promise<Response> => {
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
