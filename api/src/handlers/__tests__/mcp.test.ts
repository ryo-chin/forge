import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMcp } from '../mcp';

const mocks = vi.hoisted(() => {
  const authorizeMcpToken = vi.fn();
  const getRunningStateForUser = vi.fn();
  const listSessionsForUser = vi.fn();
  const startRunningSessionForUser = vi.fn();
  const updateRunningSessionForUser = vi.fn();
  const stopRunningSessionForUser = vi.fn();
  const cancelRunningSessionForUser = vi.fn();
  const recordSessionForUser = vi.fn();
  return {
    authorizeMcpToken,
    getRunningStateForUser,
    listSessionsForUser,
    startRunningSessionForUser,
    updateRunningSessionForUser,
    stopRunningSessionForUser,
    cancelRunningSessionForUser,
    recordSessionForUser,
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
    listSessionsForUser: mocks.listSessionsForUser,
    startRunningSessionForUser: mocks.startRunningSessionForUser,
    updateRunningSessionForUser: mocks.updateRunningSessionForUser,
    stopRunningSessionForUser: mocks.stopRunningSessionForUser,
    cancelRunningSessionForUser: mocks.cancelRunningSessionForUser,
    recordSessionForUser: mocks.recordSessionForUser,
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
          expect.objectContaining({ name: 'ForgeTimeTrackerUpdate' }),
          expect.objectContaining({ name: 'ForgeTimeTrackerStop' }),
          expect.objectContaining({ name: 'ForgeTimeTrackerCancel' }),
          expect.objectContaining({ name: 'ForgeTimeTrackerListSessions' }),
          expect.objectContaining({ name: 'ForgeTimeTrackerRecordSession' }),
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

  it('updates running sessions through the shared time tracker operation using write scope', async () => {
    mocks.getRunningStateForUser.mockResolvedValue({
      body: {
        state: {
          status: 'running',
          draft: {
            id: 'session-1',
            title: 'Focus',
            startedAt: '2026-05-01T00:00:00.000Z',
          },
          elapsedSeconds: 120,
        },
      },
    });
    mocks.updateRunningSessionForUser.mockResolvedValue({
      body: {
        state: {
          status: 'running',
          draft: {
            id: 'session-1',
            title: 'Corrected title',
            startedAt: '2026-05-01T00:00:00.000Z',
            project: 'AI駆動開発',
          },
          elapsedSeconds: 120,
        },
      },
    });

    const response = await handleMcp(
      buildRequest({
        jsonrpc: '2.0',
        id: 22,
        method: 'tools/call',
        params: {
          name: 'ForgeTimeTrackerUpdate',
          arguments: {
            id: 'session-1',
            title: 'Corrected title',
            project: 'AI駆動開発',
            elapsedSeconds: 120,
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
    expect(mocks.updateRunningSessionForUser).toHaveBeenCalledWith(env, 'user-1', {
      draft: {
        id: 'session-1',
        title: 'Corrected title',
        startedAt: '2026-05-01T00:00:00.000Z',
        project: 'AI駆動開発',
      },
      elapsedSeconds: 120,
    });
    await expect(response.json()).resolves.toMatchObject({
      result: {
        structuredContent: {
          state: {
            draft: { title: 'Corrected title' },
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
          arguments: {
            id: 'session-1',
            title: 'Corrected title',
            project: 'AI駆動開発',
            tags: ['forge'],
            notes: 'corrected at stop',
          },
        },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(mocks.stopRunningSessionForUser).toHaveBeenCalledWith(env, 'user-1', {
      id: 'session-1',
      title: 'Corrected title',
      project: 'AI駆動開発',
      tags: ['forge'],
      notes: 'corrected at stop',
    });
    await expect(response.json()).resolves.toMatchObject({
      result: {
        structuredContent: {
          sync: { status: 'skipped' },
        },
      },
    });
  });

  it('lists sessions with read scope', async () => {
    mocks.listSessionsForUser.mockResolvedValue({
      body: {
        sessions: [
          {
            id: 'session-1',
            title: 'Focus',
            startedAt: '2026-05-01T00:00:00.000Z',
            endedAt: '2026-05-01T00:10:00.000Z',
            durationSeconds: 600,
          },
        ],
      },
    });

    const response = await handleMcp(
      buildRequest({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'ForgeTimeTrackerListSessions',
          arguments: { limit: 5, query: 'Focus' },
        },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(mocks.authorizeMcpToken).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      'time-tracker:read',
    );
    expect(mocks.listSessionsForUser).toHaveBeenCalledWith(env, 'user-1', {
      limit: 5,
      query: 'Focus',
    });
    await expect(response.json()).resolves.toMatchObject({
      result: {
        structuredContent: {
          sessions: [expect.objectContaining({ id: 'session-1' })],
        },
      },
    });
  });

  it('records past sessions with write scope', async () => {
    mocks.recordSessionForUser.mockResolvedValue({
      body: {
        session: {
          id: 'session-1',
          title: 'Manual record',
          startedAt: '2026-05-01T00:00:00.000Z',
          endedAt: '2026-05-01T00:30:00.000Z',
          durationSeconds: 1800,
        },
        sync: { status: 'skipped', reason: 'connection_missing' },
        warnings: [],
      },
    });

    const response = await handleMcp(
      buildRequest({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'ForgeTimeTrackerRecordSession',
          arguments: {
            title: 'Manual record',
            startedAt: '2026-05-01T00:00:00.000Z',
            endedAt: '2026-05-01T00:30:00.000Z',
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
    expect(mocks.recordSessionForUser).toHaveBeenCalledWith(env, 'user-1', {
      title: 'Manual record',
      startedAt: '2026-05-01T00:00:00.000Z',
      endedAt: '2026-05-01T00:30:00.000Z',
    });
    await expect(response.json()).resolves.toMatchObject({
      result: {
        structuredContent: {
          session: { title: 'Manual record' },
          warnings: [],
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
