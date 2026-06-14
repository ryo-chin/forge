import type { Env } from '../env';

export const MCP_TOKEN_SCOPES = ['time-tracker:read', 'time-tracker:write'] as const;

export type McpTokenScope = (typeof MCP_TOKEN_SCOPES)[number];

export type McpTokenRow = {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  scopes: McpTokenScope[];
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type McpTokenPublic = {
  id: string;
  name: string;
  scopes: McpTokenScope[];
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export class McpTokenRepositoryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'McpTokenRepositoryError';
    this.status = status;
  }
}

const REST_PREFIX = '/rest/v1';
const TABLE = 'forge_mcp_tokens';

const ensureConfig = (env: Env) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new McpTokenRepositoryError('Supabase REST configuration is missing', 500);
  }
};

const resolveRestUrl = (env: Env, path: string, searchParams?: Record<string, string>): URL => {
  const url = new URL(`${REST_PREFIX}/${path}`, env.SUPABASE_URL);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
};

const restHeaders = (env: Env, prefer?: string): HeadersInit => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  };
  if (prefer) {
    headers.Prefer = prefer;
  }
  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  const text = await response.text();
  return text as unknown as T;
};

const request = async <T>(
  env: Env,
  method: string,
  path: string,
  options: {
    searchParams?: Record<string, string>;
    body?: unknown;
    prefer?: string;
  } = {},
): Promise<T> => {
  ensureConfig(env);
  const url = resolveRestUrl(env, path, options.searchParams);
  const response = await fetch(url, {
    method,
    headers: restHeaders(env, options.prefer),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    throw new McpTokenRepositoryError(
      `Supabase request failed: ${method} ${url.toString()} (${response.status}) ${JSON.stringify(
        detail,
      )}`,
      response.status,
    );
  }

  return handleResponse<T>(response);
};

export const toPublicMcpToken = (row: McpTokenRow): McpTokenPublic => ({
  id: row.id,
  name: row.name,
  scopes: row.scopes,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  lastUsedAt: row.last_used_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createMcpTokenRecord = async (
  env: Env,
  input: {
    userId: string;
    name: string;
    tokenHash: string;
    scopes: McpTokenScope[];
    expiresAt: string;
  },
): Promise<McpTokenRow> => {
  const rows = await request<McpTokenRow[]>(env, 'POST', TABLE, {
    body: {
      user_id: input.userId,
      name: input.name,
      token_hash: input.tokenHash,
      scopes: input.scopes,
      expires_at: input.expiresAt,
      updated_at: new Date().toISOString(),
    },
    searchParams: { select: '*' },
    prefer: 'return=representation',
  });

  return rows[0];
};

export const listMcpTokenRecords = async (env: Env, userId: string): Promise<McpTokenRow[]> =>
  request<McpTokenRow[]>(env, 'GET', TABLE, {
    searchParams: {
      user_id: `eq.${userId}`,
      select: '*',
      order: 'created_at.desc',
    },
  });

export const findMcpTokenRecordByHash = async (
  env: Env,
  tokenHash: string,
): Promise<McpTokenRow | null> => {
  const rows = await request<McpTokenRow[]>(env, 'GET', TABLE, {
    searchParams: {
      token_hash: `eq.${tokenHash}`,
      select: '*',
      limit: '1',
    },
  });
  return rows.length > 0 ? rows[0] : null;
};

export const revokeMcpTokenRecord = async (
  env: Env,
  userId: string,
  tokenId: string,
): Promise<McpTokenRow | null> => {
  const rows = await request<McpTokenRow[]>(env, 'PATCH', TABLE, {
    body: {
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    searchParams: {
      id: `eq.${tokenId}`,
      user_id: `eq.${userId}`,
      select: '*',
    },
    prefer: 'return=representation',
  });
  return rows.length > 0 ? rows[0] : null;
};

export const touchMcpTokenRecord = async (env: Env, tokenId: string): Promise<void> => {
  await request(env, 'PATCH', TABLE, {
    body: {
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    searchParams: {
      id: `eq.${tokenId}`,
    },
  });
};
