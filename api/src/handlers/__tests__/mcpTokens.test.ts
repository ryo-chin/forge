import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCreateMcpToken, handleListMcpTokens, handleRevokeMcpToken } from '../mcpTokens';

const mocks = vi.hoisted(() => {
  const verifySupabaseJwt = vi.fn();
  const generateMcpToken = vi.fn();
  const hashMcpToken = vi.fn();
  const createMcpTokenRecord = vi.fn();
  const listMcpTokenRecords = vi.fn();
  const revokeMcpTokenRecord = vi.fn();
  return {
    verifySupabaseJwt,
    generateMcpToken,
    hashMcpToken,
    createMcpTokenRecord,
    listMcpTokenRecords,
    revokeMcpTokenRecord,
  };
});

vi.mock('../../auth/verifySupabaseJwt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/verifySupabaseJwt')>();
  return {
    ...actual,
    verifySupabaseJwt: mocks.verifySupabaseJwt,
  };
});

vi.mock('../../security/mcpToken', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../security/mcpToken')>();
  return {
    ...actual,
    generateMcpToken: mocks.generateMcpToken,
    hashMcpToken: mocks.hashMcpToken,
  };
});

vi.mock('../../repositories/mcpTokens', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../repositories/mcpTokens')>();
  return {
    ...actual,
    createMcpTokenRecord: mocks.createMcpTokenRecord,
    listMcpTokenRecords: mocks.listMcpTokenRecords,
    revokeMcpTokenRecord: mocks.revokeMcpTokenRecord,
  };
});

const env = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  GOOGLE_REDIRECT_URI: '',
  MCP_TOKEN_HASH_PEPPER: 'pepper',
} as const;

const buildRequest = (method: string, body?: unknown, token = 'supabase-token') =>
  new Request('https://example.com/mcp/tokens', {
    method,
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
        },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const tokenRow = {
  id: 'token-1',
  user_id: 'user-1',
  name: 'Codex',
  token_hash: 'hash',
  scopes: ['time-tracker:read', 'time-tracker:write'],
  expires_at: '2026-08-01T00:00:00.000Z',
  revoked_at: null,
  last_used_at: null,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
} as const;

describe('MCP token handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
    mocks.verifySupabaseJwt.mockResolvedValue({ userId: 'user-1', raw: {} });
    mocks.generateMcpToken.mockReturnValue(`forge_mcp_${'a'.repeat(64)}`);
    mocks.hashMcpToken.mockResolvedValue('hash');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a scoped token and returns the raw token exactly once', async () => {
    mocks.createMcpTokenRecord.mockResolvedValue(tokenRow);

    const response = await handleCreateMcpToken(
      buildRequest('POST', {
        name: 'Codex',
        scopes: ['time-tracker:write', 'time-tracker:read'],
        expiresInDays: 30,
      }),
      env,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      token: `forge_mcp_${'a'.repeat(64)}`,
      mcpToken: {
        id: 'token-1',
        name: 'Codex',
        scopes: ['time-tracker:read', 'time-tracker:write'],
        expiresAt: '2026-08-01T00:00:00.000Z',
        revokedAt: null,
        lastUsedAt: null,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    });
    expect(mocks.createMcpTokenRecord).toHaveBeenCalledWith(
      env,
      expect.objectContaining({
        userId: 'user-1',
        tokenHash: 'hash',
        scopes: ['time-tracker:write', 'time-tracker:read'],
      }),
    );
  });

  it('rejects malformed create requests before persisting a token', async () => {
    const response = await handleCreateMcpToken(
      buildRequest('POST', { name: 'Codex', scopes: ['admin'] }),
      env,
    );

    expect(response.status).toBe(400);
    expect(mocks.createMcpTokenRecord).not.toHaveBeenCalled();
  });

  it('lists token metadata without token hashes', async () => {
    mocks.listMcpTokenRecords.mockResolvedValue([tokenRow]);

    const response = await handleListMcpTokens(buildRequest('GET'), env);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      tokens: [
        {
          id: 'token-1',
          name: 'Codex',
          scopes: ['time-tracker:read', 'time-tracker:write'],
          expiresAt: '2026-08-01T00:00:00.000Z',
          revokedAt: null,
          lastUsedAt: null,
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('hash');
  });

  it('revokes only the authenticated user token', async () => {
    mocks.revokeMcpTokenRecord.mockResolvedValue({
      ...tokenRow,
      revoked_at: '2026-05-01T01:00:00.000Z',
    });

    const response = await handleRevokeMcpToken(buildRequest('DELETE'), env, 'token-1');

    expect(response.status).toBe(200);
    expect(mocks.revokeMcpTokenRecord).toHaveBeenCalledWith(env, 'user-1', 'token-1');
    await expect(response.json()).resolves.toMatchObject({
      token: {
        id: 'token-1',
        revokedAt: '2026-05-01T01:00:00.000Z',
      },
    });
  });

  it('requires Supabase bearer auth to manage tokens', async () => {
    const response = await handleListMcpTokens(buildRequest('GET', undefined, ''), env);

    expect(response.status).toBe(401);
    expect(mocks.listMcpTokenRecords).not.toHaveBeenCalled();
  });
});
