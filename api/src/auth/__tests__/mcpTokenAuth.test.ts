import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizeMcpToken, McpTokenAuthError } from '../mcpTokenAuth';

const mocks = vi.hoisted(() => {
  const hashMcpToken = vi.fn();
  const findMcpTokenRecordByHash = vi.fn();
  const touchMcpTokenRecord = vi.fn();
  return {
    hashMcpToken,
    findMcpTokenRecordByHash,
    touchMcpTokenRecord,
  };
});

vi.mock('../../security/mcpToken', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../security/mcpToken')>();
  return {
    ...actual,
    hashMcpToken: mocks.hashMcpToken,
  };
});

vi.mock('../../repositories/mcpTokens', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../repositories/mcpTokens')>();
  return {
    ...actual,
    findMcpTokenRecordByHash: mocks.findMcpTokenRecordByHash,
    touchMcpTokenRecord: mocks.touchMcpTokenRecord,
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

const buildRequest = (token?: string) =>
  new Request('https://example.com/mcp', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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

describe('authorizeMcpToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
    mocks.hashMcpToken.mockResolvedValue('hash');
    mocks.findMcpTokenRecordByHash.mockResolvedValue(tokenRow);
    mocks.touchMcpTokenRecord.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('authorizes active MCP tokens with the required scope', async () => {
    await expect(
      authorizeMcpToken(buildRequest(`forge_mcp_${'a'.repeat(64)}`), env, 'time-tracker:write'),
    ).resolves.toEqual({
      userId: 'user-1',
      tokenId: 'token-1',
      scopes: ['time-tracker:read', 'time-tracker:write'],
    });

    expect(mocks.hashMcpToken).toHaveBeenCalledWith(`forge_mcp_${'a'.repeat(64)}`, 'pepper');
    expect(mocks.findMcpTokenRecordByHash).toHaveBeenCalledWith(env, 'hash');
    expect(mocks.touchMcpTokenRecord).toHaveBeenCalledWith(env, 'token-1');
  });

  it('returns 401 for missing, unknown, revoked, or expired tokens', async () => {
    await expect(authorizeMcpToken(buildRequest(), env, 'time-tracker:read')).rejects.toMatchObject(
      { status: 401 },
    );

    mocks.findMcpTokenRecordByHash.mockResolvedValueOnce(null);
    await expect(
      authorizeMcpToken(buildRequest(`forge_mcp_${'a'.repeat(64)}`), env, 'time-tracker:read'),
    ).rejects.toMatchObject({ status: 401 });

    mocks.findMcpTokenRecordByHash.mockResolvedValueOnce({
      ...tokenRow,
      revoked_at: '2026-05-01T00:00:00.000Z',
    });
    await expect(
      authorizeMcpToken(buildRequest(`forge_mcp_${'a'.repeat(64)}`), env, 'time-tracker:read'),
    ).rejects.toMatchObject({ status: 401 });

    mocks.findMcpTokenRecordByHash.mockResolvedValueOnce({
      ...tokenRow,
      expires_at: '2026-04-30T00:00:00.000Z',
    });
    await expect(
      authorizeMcpToken(buildRequest(`forge_mcp_${'a'.repeat(64)}`), env, 'time-tracker:read'),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('returns 403 when the token lacks the required scope', async () => {
    mocks.findMcpTokenRecordByHash.mockResolvedValueOnce({
      ...tokenRow,
      scopes: ['time-tracker:read'],
    });

    await expect(
      authorizeMcpToken(buildRequest(`forge_mcp_${'a'.repeat(64)}`), env, 'time-tracker:write'),
    ).rejects.toEqual(new McpTokenAuthError('Insufficient scope', 403));
  });
});
