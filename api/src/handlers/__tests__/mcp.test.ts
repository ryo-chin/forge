import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMcp } from '../mcp';

const mocks = vi.hoisted(() => {
  const authorizeMcpToken = vi.fn();
  const getRunningStateForUser = vi.fn();
  const startRunningSessionForUser = vi.fn();
  const stopRunningSessionForUser = vi.fn();
  const cancelRunningSessionForUser = vi.fn();
  return {
    authorizeMcpToken,
    getRunningStateForUser,
    startRunningSessionForUser,
    stopRunningSessionForUser,
    cancelRunningSessionForUser,
  };
});

vi.mock('../../auth/mcpTokenAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/mcpTokenAuth')>();
  return {
    ...actual,
    authorizeMcpToken: mocks.authorizeMcpToken,
  };
});

vi.mock('../timeTracker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../timeTracker')>();
  return {
    ...actual,
    getRunningStateForUser: mocks.getRunningStateForUser,
    startRunningSessionForUser: mocks.startRunningSessionForUser,
    stopRunningSessionForUser: mocks.stopRunningSessionForUser,
    cancelRunningSessionForUser: mocks.cancelRunningSessionForUser,
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

const buildRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://example.com/mcp', {
    method: 'POST',
    headers: {
      Authorization: `Bearer forge_mcp_${'a'.repeat(64)}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe('remote HTTP MCP handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeMcpToken.mockResolvedValue({
      userId: 'user-1',
      tokenId: 'token-1',
      scopes: ['time-tracker:read', 'time-tracker:write'],
    });
  });

  it('initializes a stateless MCP server with bearer auth', async () => {
    const response = await handleMcp(
      buildRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        capabilities: { tools: {} },
        serverInfo: { name: 'forge-time-tracker' },
      },
    });
    expect(mocks.authorizeMcpToken).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      'time-tracker:read',
    );
  });

  it('lists the Forge time tracker tools', async () => {
    const response = await handleMcp(
      buildRequest({ jsonrpc: '2.0', id: 'tools', method: 'tools/list' }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'ForgeTimeTrackerStart' }),
          expect.objectContaining({ name: 'ForgeTimeTrackerStatus' }),
          expect.objectContaining({ name: 'ForgeTimeTrackerStop' }),
          expect.objectContaining({ name: 'ForgeTimeTrackerCancel' }),
        ]),
      },
    });
  });

  it('starts sessions through the shared time tracker operation using write scope', async () => {
    mocks.startRunningSessionForUser.mockResolvedValue({
      body: {
        state: {
          status: 'running',
          draft: {
            id: 'session-1',
            title: 'Focus',
            startedAt: '2026-05-01T00:00:00.000Z',
          },
          elapsedSeconds: 0,
        },
      },
      status: 201,
    });

    const response = await handleMcp(
      buildRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'ForgeTimeTrackerStart',
          arguments: {
            id: 'session-1',
            title: 'Focus',
            startedAt: '2026-05-01T00:00:00.000Z',
            project: 'Forge',
          },
        },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(mocks.authorizeMcpToken).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      'time-tracker:write',
    );
    expect(mocks.startRunningSessionForUser).toHaveBeenCalledWith(env, 'user-1', {
      draft: expect.objectContaining({
        id: 'session-1',
        title: 'Focus',
        project: 'Forge',
      }),
    });
    await expect(response.json()).resolves.toMatchObject({
      result: {
        structuredContent: {
          state: {
            status: 'running',
          },
        },
      },
    });
  });

  it('stops sessions and preserves Google sync details in structured content', async () => {
    mocks.stopRunningSessionForUser.mockResolvedValue({
      body: {
        session: { id: 'session-1', title: 'Focus' },
        sync: { status: 'skipped', reason: 'connection_missing' },
      },
    });

    const response = await handleMcp(
      buildRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'ForgeTimeTrackerStop',
          arguments: { id: 'session-1' },
        },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(mocks.stopRunningSessionForUser).toHaveBeenCalledWith(env, 'user-1', {
      id: 'session-1',
    });
    await expect(response.json()).resolves.toMatchObject({
      result: {
        structuredContent: {
          sync: { status: 'skipped' },
        },
      },
    });
  });

  it('rejects mismatched MCP routing headers before tool execution', async () => {
    const response = await handleMcp(
      buildRequest({ jsonrpc: '2.0', id: 4, method: 'tools/list' }, { 'Mcp-Method': 'tools/call' }),
      env,
    );

    expect(response.status).toBe(400);
    expect(mocks.getRunningStateForUser).not.toHaveBeenCalled();
  });
});
