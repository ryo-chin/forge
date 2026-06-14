import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRunningState, insertSession, listSessions, upsertRunningState } from '../timeTracker';

const env = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  GOOGLE_REDIRECT_URI: '',
} as const;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('time tracker Supabase repository', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads running state with an explicit verified-user filter', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          status: 'running',
          elapsed_seconds: 5,
          draft: {
            id: 'session-1',
            title: 'Focus',
            startedAt: '2026-04-30T00:00:00.000Z',
          },
        },
      ]),
    );

    const state = await getRunningState(env, 'user-1');

    expect(state).toEqual({
      status: 'running',
      draft: {
        id: 'session-1',
        title: 'Focus',
        startedAt: '2026-04-30T00:00:00.000Z',
      },
      elapsedSeconds: 5,
    });

    const [url, init] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.pathname).toBe('/rest/v1/time_tracker_running_states');
    expect(parsedUrl.searchParams.get('user_id')).toBe('eq.user-1');
    expect(parsedUrl.searchParams.get('select')).toBe('status,elapsed_seconds,draft');
    expect(init).toMatchObject({ method: 'GET' });
  });

  it('upserts running state with user_id derived from the verified user', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          status: 'running',
          elapsed_seconds: 0,
          draft: {
            id: 'session-1',
            title: 'Focus',
            startedAt: '2026-04-30T00:00:00.000Z',
          },
        },
      ]),
    );

    await upsertRunningState(env, 'user-1', {
      status: 'running',
      draft: {
        id: 'session-1',
        title: 'Focus',
        startedAt: '2026-04-30T00:00:00.000Z',
      },
      elapsedSeconds: 0,
    });

    const [url, init] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.pathname).toBe('/rest/v1/time_tracker_running_states');
    expect(parsedUrl.searchParams.get('on_conflict')).toBe('user_id');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      user_id: 'user-1',
      status: 'running',
      elapsed_seconds: 0,
    });
  });

  it('inserts completed sessions with user_id derived from the verified user', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          id: 'session-1',
          title: 'Focus',
          started_at: '2026-04-30T00:00:00.000Z',
          ended_at: '2026-04-30T00:05:00.000Z',
          duration_seconds: 300,
          project: 'Forge',
          notes: null,
          tags: ['mcp'],
        },
      ]),
    );

    await insertSession(env, 'user-1', {
      id: 'session-1',
      title: 'Focus',
      startedAt: '2026-04-30T00:00:00.000Z',
      endedAt: '2026-04-30T00:05:00.000Z',
      durationSeconds: 300,
      project: 'Forge',
      tags: ['mcp'],
    });

    const [url, init] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.pathname).toBe('/rest/v1/time_tracker_sessions');
    expect(parsedUrl.searchParams.get('on_conflict')).toBeNull();
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      id: 'session-1',
      user_id: 'user-1',
      title: 'Focus',
      started_at: '2026-04-30T00:00:00.000Z',
      ended_at: '2026-04-30T00:05:00.000Z',
      duration_seconds: 300,
      project: 'Forge',
    });
  });

  it('lists recent sessions with verified-user and bounded filters', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          id: 'session-1',
          title: 'Focus',
          started_at: '2026-04-30T00:00:00.000Z',
          ended_at: '2026-04-30T00:05:00.000Z',
          duration_seconds: 300,
          project: 'Forge',
          notes: null,
          tags: ['mcp'],
        },
      ]),
    );

    const sessions = await listSessions(env, 'user-1', {
      limit: 5,
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-05-01T00:00:00.000Z',
      query: 'Focus',
      project: 'Forge',
      tags: ['mcp'],
    });

    expect(sessions).toEqual([
      {
        id: 'session-1',
        title: 'Focus',
        startedAt: '2026-04-30T00:00:00.000Z',
        endedAt: '2026-04-30T00:05:00.000Z',
        durationSeconds: 300,
        project: 'Forge',
        tags: ['mcp'],
      },
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.pathname).toBe('/rest/v1/time_tracker_sessions');
    expect(parsedUrl.searchParams.get('select')).toBe(
      'id,title,started_at,ended_at,duration_seconds,tags,project,notes',
    );
    expect(parsedUrl.searchParams.get('user_id')).toBe('eq.user-1');
    expect(parsedUrl.searchParams.get('order')).toBe('started_at.desc');
    expect(parsedUrl.searchParams.get('limit')).toBe('5');
    expect(parsedUrl.searchParams.get('and')).toBe(
      '(started_at.gte.2026-04-01T00:00:00.000Z,started_at.lte.2026-05-01T00:00:00.000Z)',
    );
    expect(parsedUrl.searchParams.get('or')).toBe(
      '(title.ilike.*Focus*,project.ilike.*Focus*,notes.ilike.*Focus*)',
    );
    expect(parsedUrl.searchParams.get('project')).toBe('eq.Forge');
    expect(parsedUrl.searchParams.get('tags')).toBe('cs.{mcp}');
    expect(init).toMatchObject({ method: 'GET' });
  });
});
