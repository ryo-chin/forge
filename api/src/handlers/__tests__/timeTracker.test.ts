import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleCancelRunningSession,
  handleGetRunningState,
  handleStartRunningSession,
  handleStopRunningSession,
  handleUpdateRunningSession,
} from '../timeTracker';

const mocks = vi.hoisted(() => {
  const verifySupabaseJwt = vi.fn();
  const getRunningState = vi.fn();
  const upsertRunningState = vi.fn();
  const insertSession = vi.fn();
  return {
    verifySupabaseJwt,
    getRunningState,
    upsertRunningState,
    insertSession,
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
    upsertRunningState: mocks.upsertRunningState,
    insertSession: mocks.insertSession,
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
    mocks.verifySupabaseJwt.mockResolvedValue({
      userId: 'user-1',
      raw: {},
    });
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
    });
    expect(mocks.insertSession).toHaveBeenCalledWith(env, 'user-1', completedSession);
    expect(mocks.upsertRunningState).toHaveBeenCalledWith(env, 'user-1', idleState);
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
