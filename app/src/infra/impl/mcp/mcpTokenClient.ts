import { buildGoogleSyncUrl, getGoogleSyncApiBaseUrl, isGoogleSyncEnabled } from '@infra/config';

export const MCP_TOKEN_SCOPES = ['time-tracker:read', 'time-tracker:write'] as const;

export type McpTokenScope = (typeof MCP_TOKEN_SCOPES)[number];

export type McpToken = {
  id: string;
  name: string;
  scopes: McpTokenScope[];
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListMcpTokensResponse = {
  tokens: McpToken[];
};

export type CreateMcpTokenPayload = {
  name: string;
  scopes: McpTokenScope[];
  expiresInDays: number;
};

export type CreateMcpTokenResponse = {
  token: string;
  mcpToken: McpToken;
};

export type RevokeMcpTokenResponse = {
  token: McpToken;
};

export class McpTokenClientError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'McpTokenClientError';
    this.status = status;
    this.detail = detail;
  }
}

const buildHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const request = async <T>(token: string, path: string, init: RequestInit = {}): Promise<T> => {
  if (!isGoogleSyncEnabled()) {
    throw new McpTokenClientError('Forge API is disabled', 503);
  }

  const base = getGoogleSyncApiBaseUrl();
  if (!base) {
    throw new McpTokenClientError('Forge API base URL is not configured', 500);
  }

  const response = await fetch(buildGoogleSyncUrl(path), {
    ...init,
    headers: {
      ...buildHeaders(token),
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    throw new McpTokenClientError(
      `MCP token request failed (${response.status}) ${JSON.stringify(detail)}`,
      response.status,
      detail,
    );
  }

  if (response.headers.get('content-type')?.includes('application/json') ?? false) {
    return (await response.json()) as T;
  }
  const text = await response.text();
  return text as T;
};

export const listMcpTokens = (token: string): Promise<ListMcpTokensResponse> =>
  request(token, '/mcp/tokens', { method: 'GET' });

export const createMcpToken = (
  token: string,
  payload: CreateMcpTokenPayload,
): Promise<CreateMcpTokenResponse> =>
  request(token, '/mcp/tokens', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const revokeMcpToken = (token: string, tokenId: string): Promise<RevokeMcpTokenResponse> =>
  request(token, `/mcp/tokens/${encodeURIComponent(tokenId)}`, {
    method: 'DELETE',
  });

export const isMcpTokenClientEnabled = (): boolean => isGoogleSyncEnabled();
