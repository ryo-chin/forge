import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMcpToken,
  listMcpTokens,
  McpTokenClientError,
  revokeMcpToken,
} from '../mcpTokenClient.ts';

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

describe('mcpTokenClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('lists MCP token metadata with Supabase bearer auth', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        tokens: [
          {
            id: 'token-1',
            name: 'Codex',
            scopes: ['time-tracker:read'],
            expiresAt: '2026-08-01T00:00:00.000Z',
            revokedAt: null,
            lastUsedAt: null,
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
      }),
    );

    await expect(listMcpTokens('supabase-token')).resolves.toMatchObject({
      tokens: [{ id: 'token-1', name: 'Codex' }],
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/mcp/tokens', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer supabase-token',
        'Content-Type': 'application/json',
      },
    });
  });

  it('creates an MCP token and returns the raw token response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          token: 'forge_mcp_raw-token',
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
        },
        { status: 201 },
      ),
    );

    await expect(
      createMcpToken('supabase-token', {
        name: 'Codex',
        scopes: ['time-tracker:read', 'time-tracker:write'],
        expiresInDays: 90,
      }),
    ).resolves.toMatchObject({ token: 'forge_mcp_raw-token' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/mcp/tokens',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Codex',
          scopes: ['time-tracker:read', 'time-tracker:write'],
          expiresInDays: 90,
        }),
      }),
    );
  });

  it('revokes an MCP token by id', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        token: {
          id: 'token/1',
          name: 'Codex',
          scopes: ['time-tracker:read'],
          expiresAt: '2026-08-01T00:00:00.000Z',
          revokedAt: '2026-05-01T01:00:00.000Z',
          lastUsedAt: null,
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T01:00:00.000Z',
        },
      }),
    );

    await expect(revokeMcpToken('supabase-token', 'token/1')).resolves.toMatchObject({
      token: { revokedAt: '2026-05-01T01:00:00.000Z' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/mcp/tokens/token%2F1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws typed errors with response details', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'bad_request' }, { status: 400 }));

    await expect(listMcpTokens('supabase-token')).rejects.toMatchObject({
      name: 'McpTokenClientError',
      status: 400,
      detail: { error: 'bad_request' },
    });
  });

  it('fails before requesting when the API base URL is not configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    await expect(listMcpTokens('supabase-token')).rejects.toBeInstanceOf(McpTokenClientError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
