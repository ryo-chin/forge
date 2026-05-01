import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleCancelRunningSession,
  handleGetRunningState,
  handleStartRunningSession,
  handleStopRunningSession,
  handleUpdateRunningSession,
  listSessionsForUser,
  recordSessionForUser,
} from '../timeTracker';

const mocks = vi.hoisted(() => {
  const verifySupabaseJwt = vi.fn();
  const getRunningState = vi.fn();
  const listSessions = vi.fn();
  const upsertRunningState = vi.fn();
  const insertSession = vi.fn();
  const syncSessionForUser = vi.fn();
  return {
    verifySupabaseJwt,
    getRunningState,
    listSessions,
    upsertRunningState,
    insertSession,
    syncSessionForUser,
  };
});

vi.mock('../../auth/verifySupabaseJwt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/verifySupabaseJwt')>();
  return {
    ...actual,
    verifySupabaseJwt: mocks.verifySupabaseJwt,
  };
});

vi.mock('../../repositories/timeTracker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../repositories/timeTracker')>();
  return {
    ...actual,
    getRunningState: mocks.getRunningState,
    listSessions: mocks.listSessions,
    upsertRunningState: mocks.upsertRunningState,
    insertSession: mocks.insertSession,
  };
});

vi.mock('../syncSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../syncSession')>();
  return {
    ...actual,
    syncSessionForUser: mocks.syncSessionForUser,
  };
});

const env = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  GOOGLE_REDIRECT_URI: '',
} as const;

const buildRequest = (method: string, path: string, body?: unknown) =>
  new Request(`https://example.com${path}`, {
    method,
    headers: {
      Authorization: 'Bearer supabase-token',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const draft = {
  id: 'session-1',
  title: 'Focus',
  startedAt: '2026-04-30T00:00:00.000Z',
  project: 'Forge',
  tags: ['mcp'],
  notes: 'local test',
};

const runningState = {
  status: 'running' as const,
  draft,
  elapsedSeconds: 0,
};

const idleState = {
  status: 'idle' as const,
  draft: null,
  elapsedSeconds: 0,
};

describe('time tracker canonical Worker handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00.000Z'));
    mocks.verifySupabaseJwt.mockResolvedValue({
      userId: 'user-1',
      raw: {},
    });
    mocks.syncSessionForUser.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'connection_missing',
          message: 'Google spreadsheet connection not found',
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns idle state when the user has no running row', async () => {
    mocks.getRunningState.mockResolvedValue(null);

    const response = await handleGetRunningState(buildRequest('GET', '/time-tracker/running'), env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ state: idleState });
    expect(mocks.getRunningState).toHaveBeenCalledWith(env, 'user-1');
  });

  it('starts a running session using the verified user id only', async () => {
    mocks.getRunningState.mockResolvedValue(null);
    mocks.upsertRunningState.mockResolvedValue(runningState);

    const response = await handleStartRunningSession(
      buildRequest('POST', '/time-tracker/running/start', {
        user_id: 'attacker-user',
        draft,
      }),
      env,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ state: runningState });
    expect(mocks.upsertRunningState).toHaveBeenCalledWith(env, 'user-1', runningState);
  });

  it('rejects start when another session is already running', async () => {
    mocks.getRunningState.mockResolvedValue({
      ...runningState,
      draft: { ...draft, id: 'other-session' },
    });

    const response = await handleStartRunningSession(
      buildRequest('POST', '/time-tracker/running/start', { draft }),
      env,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: 'already_running' });
    expect(mocks.upsertRunningState).not.toHaveBeenCalled();
  });

  it('updates the current running state when the draft id matches', async () => {
    mocks.getRunningState.mockResolvedValue(runningState);
    mocks.upsertRunningState.mockResolvedValue({
      ...runningState,
      elapsedSeconds: 120,
    });

    const response = await handleUpdateRunningSession(
      buildRequest('PATCH', '/time-tracker/running/update', {
        draft: { ...draft, title: 'Deep Work' },
        elapsedSeconds: 120,
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(mocks.upsertRunningState).toHaveBeenCalledWith(env, 'user-1', {
      status: 'running',
      draft: { ...draft, title: 'Deep Work' },
      elapsedSeconds: 120,
    });
  });

  it('stops the running session, creates a completed session, and clears running state', async () => {
    const stoppedAt = '2026-04-30T00:05:00.000Z';
    const completedSession = {
      id: 'session-1',
      title: 'Focus',
      startedAt: draft.startedAt,
      endedAt: stoppedAt,
      durationSeconds: 300,
      project: 'Forge',
      tags: ['mcp'],
      notes: 'local test',
    };
    mocks.getRunningState.mockResolvedValue(runningState);
    mocks.insertSession.mockResolvedValue(completedSession);
    mocks.upsertRunningState.mockResolvedValue(idleState);

    const response = await handleStopRunningSession(
      buildRequest('POST', '/time-tracker/running/stop', { id: 'session-1', stoppedAt }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      session: completedSession,
      state: idleState,
      sync: {
        status: 'skipped',
        reason: 'Google spreadsheet connection not found',
        detail: {
          error: 'connection_missing',
          message: 'Google spreadsheet connection not found',
        },
      },
    });
    expect(mocks.insertSession).toHaveBeenCalledWith(env, 'user-1', completedSession);
    expect(mocks.upsertRunningState).toHaveBeenCalledWith(env, 'user-1', idleState);
    expect(mocks.syncSessionForUser).toHaveBeenCalledTimes(1);
  });

  it('returns Google Sheets sync success when stop sync succeeds', async () => {
    const stoppedAt = '2026-04-30T00:05:00.000Z';
    const completedSession = {
      id: 'session-1',
      title: 'Focus',
      startedAt: draft.startedAt,
      endedAt: stoppedAt,
      durationSeconds: 300,
      project: 'Forge',
      tags: ['mcp'],
      notes: 'local test',
    };
    const syncLog = {
      id: 'sync-1',
      sessionId: 'session-1',
      status: 'success',
      attemptedAt: '2026-04-30T00:05:01.000Z',
      retryCount: 0,
    };
    mocks.getRunningState.mockResolvedValue(runningState);
    mocks.insertSession.mockResolvedValue(completedSession);
    mocks.upsertRunningState.mockResolvedValue(idleState);
    mocks.syncSessionForUser.mockResolvedValue(
      new Response(JSON.stringify(syncLog), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await handleStopRunningSession(
      buildRequest('POST', '/time-tracker/running/stop', { id: 'session-1', stoppedAt }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      session: completedSession,
      state: idleState,
      sync: {
        status: 'success',
        log: syncLog,
      },
    });
    expect(mocks.syncSessionForUser).toHaveBeenCalledWith(
      env,
      'user-1',
      expect.objectContaining({
        source: 'time-tracker-worker-api',
        session: completedSession,
      }),
    );
  });

  it('lists completed sessions using bounded filters', async () => {
    const sessions = [
      {
        id: 'session-1',
        title: 'Focus',
        startedAt: '2026-04-30T00:00:00.000Z',
        endedAt: '2026-04-30T00:05:00.000Z',
        durationSeconds: 300,
      },
    ];
    mocks.listSessions.mockResolvedValue(sessions);

    const result = await listSessionsForUser(env, 'user-1', {
      limit: 5,
      from: '2026-04-01T00:00:00.000Z',
      query: 'Focus',
      tags: ['mcp'],
    });

    expect(result).toEqual({ body: { sessions } });
    expect(mocks.listSessions).toHaveBeenCalledWith(env, 'user-1', {
      limit: 5,
      from: '2026-04-01T00:00:00.000Z',
      to: undefined,
      query: 'Focus',
      project: undefined,
      tags: ['mcp'],
    });
  });

  it('records a completed past session without touching running state', async () => {
    const completedSession = {
      id: 'session-1',
      title: 'Manual record',
      startedAt: '2026-05-01T00:00:00.000Z',
      endedAt: '2026-05-01T00:30:00.000Z',
      durationSeconds: 1800,
      project: 'Forge',
      tags: ['mcp'],
    };
    mocks.insertSession.mockResolvedValue(completedSession);

    const result = await recordSessionForUser(env, 'user-1', {
      id: 'session-1',
      title: 'Manual record',
      startedAt: completedSession.startedAt,
      endedAt: completedSession.endedAt,
      project: 'Forge',
      tags: ['mcp'],
    });

    expect(result).toEqual({
      status: 201,
      body: {
        session: completedSession,
        warnings: [],
        sync: {
          status: 'skipped',
          reason: 'Google spreadsheet connection not found',
          detail: {
            error: 'connection_missing',
            message: 'Google spreadsheet connection not found',
          },
        },
      },
    });
    expect(mocks.insertSession).toHaveBeenCalledWith(env, 'user-1', completedSession);
    expect(mocks.getRunningState).not.toHaveBeenCalled();
    expect(mocks.upsertRunningState).not.toHaveBeenCalled();
  });

  it('dry-runs manual records without persisting or syncing', async () => {
    const result = await recordSessionForUser(env, 'user-1', {
      id: 'session-1',
      title: 'Manual record',
      startedAt: '2026-05-01T00:00:00.000Z',
      endedAt: '2026-05-01T00:30:00.000Z',
      dryRun: true,
    });

    expect(result).toEqual({
      body: {
        session: {
          id: 'session-1',
          title: 'Manual record',
          startedAt: '2026-05-01T00:00:00.000Z',
          endedAt: '2026-05-01T00:30:00.000Z',
          durationSeconds: 1800,
        },
        dryRun: true,
        warnings: [],
        sync: { status: 'skipped', reason: 'dry_run' },
      },
    });
    expect(mocks.insertSession).not.toHaveBeenCalled();
    expect(mocks.syncSessionForUser).not.toHaveBeenCalled();
  });

  it('rejects manual records in the future', async () => {
    await expect(
      recordSessionForUser(env, 'user-1', {
        title: 'Future record',
        startedAt: '2026-05-02T00:00:00.000Z',
        endedAt: '2026-05-02T00:30:00.000Z',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ status: 400 }),
    });
    expect(mocks.insertSession).not.toHaveBeenCalled();
  });

  it('keeps the completed session when Google Sheets sync fails', async () => {
    const stoppedAt = '2026-04-30T00:05:00.000Z';
    const completedSession = {
      id: 'session-1',
      title: 'Focus',
      startedAt: draft.startedAt,
      endedAt: stoppedAt,
      durationSeconds: 300,
      project: 'Forge',
      tags: ['mcp'],
      notes: 'local test',
    };
    mocks.getRunningState.mockResolvedValue(runningState);
    mocks.insertSession.mockResolvedValue(completedSession);
    mocks.upsertRunningState.mockResolvedValue(idleState);
    mocks.syncSessionForUser.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'internal_error',
          message: 'Failed to refresh access token',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const response = await handleStopRunningSession(
      buildRequest('POST', '/time-tracker/running/stop', { id: 'session-1', stoppedAt }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: completedSession,
      state: idleState,
      sync: {
        status: 'failed',
        statusCode: 401,
        error: 'Failed to refresh access token',
      },
    });
  });

  it('cancels the current running session without creating a completed session', async () => {
    mocks.getRunningState.mockResolvedValue(runningState);
    mocks.upsertRunningState.mockResolvedValue(idleState);

    const response = await handleCancelRunningSession(
      buildRequest('POST', '/time-tracker/running/cancel', { id: 'session-1' }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ state: idleState });
    expect(mocks.insertSession).not.toHaveBeenCalled();
    expect(mocks.upsertRunningState).toHaveBeenCalledWith(env, 'user-1', idleState);
  });
});
