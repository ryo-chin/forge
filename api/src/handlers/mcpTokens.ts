import {
  extractBearerToken,
  SupabaseAuthError,
  verifySupabaseJwt,
} from '../auth/verifySupabaseJwt';
import type { Env } from '../env';
import { badRequest, jsonResponse, serverError, unauthorized } from '../http/response';
import {
  createMcpTokenRecord,
  listMcpTokenRecords,
  MCP_TOKEN_SCOPES,
  type McpTokenScope,
  revokeMcpTokenRecord,
  toPublicMcpToken,
} from '../repositories/mcpTokens';
import { generateMcpToken, hashMcpToken, McpTokenCryptoError } from '../security/mcpToken';

const DEFAULT_EXPIRES_IN_DAYS = 90;
const MAX_EXPIRES_IN_DAYS = 365;

class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

const ensureSupabaseUser = async (request: Request, env: Env): Promise<{ userId: string }> => {
  const token = extractBearerToken(request);
  if (!token) {
    throw new SupabaseAuthError('Bearer token is required', 401);
  }
  return verifySupabaseJwt(token, env);
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const parseBody = async (request: Request): Promise<Record<string, unknown>> => {
  try {
    return asObject(await request.json()) ?? {};
  } catch {
    return {};
  }
};

const normalizeName = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new RequestValidationError('name is required');
  }
  const name = value.trim();
  if (name.length === 0) {
    throw new RequestValidationError('name is required');
  }
  if (name.length > 80) {
    throw new RequestValidationError('name must be at most 80 characters');
  }
  return name;
};

const normalizeScopes = (value: unknown): McpTokenScope[] => {
  if (value === undefined) {
    return [...MCP_TOKEN_SCOPES];
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new RequestValidationError('scopes must be a non-empty array');
  }

  const normalized = new Set<McpTokenScope>();
  for (const scope of value) {
    if (!MCP_TOKEN_SCOPES.includes(scope as McpTokenScope)) {
      throw new RequestValidationError(`unsupported scope: ${String(scope)}`);
    }
    normalized.add(scope as McpTokenScope);
  }
  return [...normalized];
};

const normalizeExpiresAt = (value: unknown): string => {
  const days = value === undefined ? DEFAULT_EXPIRES_IN_DAYS : value;
  if (typeof days !== 'number' || !Number.isFinite(days)) {
    throw new RequestValidationError('expiresInDays must be a number');
  }
  if (days < 1 || days > MAX_EXPIRES_IN_DAYS) {
    throw new RequestValidationError(`expiresInDays must be between 1 and ${MAX_EXPIRES_IN_DAYS}`);
  }

  const expiresAt = new Date(Date.now() + Math.floor(days) * 24 * 60 * 60 * 1000);
  return expiresAt.toISOString();
};

const handleAuthError = (error: unknown): Response | null => {
  if (error instanceof SupabaseAuthError) {
    return error.status >= 500
      ? serverError(error.message, error.status)
      : unauthorized(error.message);
  }
  if (error instanceof McpTokenCryptoError) {
    return serverError(error.message, 500);
  }
  return null;
};

export const handleCreateMcpToken = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureSupabaseUser(request, env);
    const body = await parseBody(request);
    const name = normalizeName(body.name);
    const scopes = normalizeScopes(body.scopes);
    const expiresAt = normalizeExpiresAt(body.expiresInDays);
    const token = generateMcpToken();
    const tokenHash = await hashMcpToken(token, env.MCP_TOKEN_HASH_PEPPER);
    const row = await createMcpTokenRecord(env, {
      userId: auth.userId,
      name,
      tokenHash,
      scopes,
      expiresAt,
    });

    return jsonResponse({ token, mcpToken: toPublicMcpToken(row) }, 201);
  } catch (error) {
    const authError = handleAuthError(error);
    if (authError) return authError;
    if (error instanceof RequestValidationError) return badRequest(error.message);
    if (error instanceof Error) return serverError(error.message);
    return serverError('Unknown error');
  }
};

export const handleListMcpTokens = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureSupabaseUser(request, env);
    const rows = await listMcpTokenRecords(env, auth.userId);
    return jsonResponse({ tokens: rows.map(toPublicMcpToken) });
  } catch (error) {
    const authError = handleAuthError(error);
    if (authError) return authError;
    if (error instanceof Error) return serverError(error.message);
    return serverError('Unknown error');
  }
};

export const handleRevokeMcpToken = async (
  request: Request,
  env: Env,
  tokenId: string,
): Promise<Response> => {
  try {
    const auth = await ensureSupabaseUser(request, env);
    const row = await revokeMcpTokenRecord(env, auth.userId, tokenId);
    if (!row) {
      return jsonResponse({ status: 'not_found' }, 404);
    }
    return jsonResponse({ token: toPublicMcpToken(row) });
  } catch (error) {
    const authError = handleAuthError(error);
    if (authError) return authError;
    if (error instanceof Error) return serverError(error.message);
    return serverError('Unknown error');
  }
};
