import type { Env } from '../env';
import {
  findMcpTokenRecordByHash,
  type McpTokenScope,
  touchMcpTokenRecord,
} from '../repositories/mcpTokens';
import { hashMcpToken, McpTokenCryptoError } from '../security/mcpToken';
import { extractBearerToken } from './verifySupabaseJwt';

export type McpTokenAuthResult = {
  userId: string;
  tokenId: string;
  scopes: McpTokenScope[];
};

export class McpTokenAuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'McpTokenAuthError';
    this.status = status;
  }
}

export const authorizeMcpToken = async (
  request: Request,
  env: Env,
  requiredScope: McpTokenScope,
): Promise<McpTokenAuthResult> => {
  const token = extractBearerToken(request);
  if (!token) {
    throw new McpTokenAuthError('Bearer token is required', 401);
  }

  let tokenHash: string;
  try {
    tokenHash = await hashMcpToken(token, env.MCP_TOKEN_HASH_PEPPER);
  } catch (error) {
    if (error instanceof McpTokenCryptoError) {
      throw new McpTokenAuthError(error.message, error.message.includes('required') ? 500 : 401);
    }
    throw new McpTokenAuthError('Invalid token', 401);
  }

  const record = await findMcpTokenRecordByHash(env, tokenHash);
  if (!record) {
    throw new McpTokenAuthError('Invalid token', 401);
  }
  if (record.revoked_at) {
    throw new McpTokenAuthError('Invalid token', 401);
  }
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    throw new McpTokenAuthError('Invalid token', 401);
  }
  if (!record.scopes.includes(requiredScope)) {
    throw new McpTokenAuthError('Insufficient scope', 403);
  }

  await touchMcpTokenRecord(env, record.id);

  return {
    userId: record.user_id,
    tokenId: record.id,
    scopes: record.scopes,
  };
};
