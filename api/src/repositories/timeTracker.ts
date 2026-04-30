import type { Env } from '../env';
import type { RunningSessionStatePayload, TimeTrackerSessionPayload } from '../types';

type RunningStateRow = {
  status: 'idle' | 'running';
  elapsed_seconds: number | null;
  draft: RunningSessionStatePayload['draft'] | null;
};

type SessionRow = {
  id: string;
  title: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number | null;
  tags: string[] | null;
  project: string | null;
  notes: string | null;
};

export class TimeTrackerRepositoryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TimeTrackerRepositoryError';
    this.status = status;
  }
}

const REST_PREFIX = '/rest/v1';

const ensureConfig = (env: Env) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new TimeTrackerRepositoryError('Supabase REST configuration is missing', 500);
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
    throw new TimeTrackerRepositoryError(
      `Supabase request failed: ${method} ${url.toString()} (${response.status}) ${JSON.stringify(
        detail,
      )}`,
      response.status,
    );
  }

  return handleResponse<T>(response);
};

const mapRunningStateRow = (row: RunningStateRow): RunningSessionStatePayload => {
  if (row.status !== 'running' || !row.draft) {
    return { status: 'idle', draft: null, elapsedSeconds: 0 };
  }

  return {
    status: 'running',
    draft: row.draft,
    elapsedSeconds: row.elapsed_seconds ?? 0,
  };
};

const mapSessionRow = (row: SessionRow): TimeTrackerSessionPayload => {
  const session: TimeTrackerSessionPayload = {
    id: row.id,
    title: row.title,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds ?? 0,
  };

  if (Array.isArray(row.tags) && row.tags.length > 0) {
    session.tags = row.tags;
  }
  if (row.project) {
    session.project = row.project;
  }
  if (row.notes) {
    session.notes = row.notes;
  }

  return session;
};

export const getRunningState = async (
  env: Env,
  userId: string,
): Promise<RunningSessionStatePayload | null> => {
  const rows = await request<RunningStateRow[]>(env, 'GET', 'time_tracker_running_states', {
    searchParams: {
      select: 'status,elapsed_seconds,draft',
      user_id: `eq.${userId}`,
      limit: '1',
    },
  });

  return rows.length > 0 ? mapRunningStateRow(rows[0]) : null;
};

export const upsertRunningState = async (
  env: Env,
  userId: string,
  state: RunningSessionStatePayload,
): Promise<RunningSessionStatePayload> => {
  const rows = await request<RunningStateRow[]>(env, 'POST', 'time_tracker_running_states', {
    body: {
      user_id: userId,
      status: state.status,
      elapsed_seconds: state.elapsedSeconds,
      draft: state.status === 'running' ? state.draft : null,
      updated_at: new Date().toISOString(),
    },
    searchParams: {
      on_conflict: 'user_id',
      select: 'status,elapsed_seconds,draft',
    },
    prefer: 'resolution=merge-duplicates,return=representation',
  });

  return mapRunningStateRow(rows[0]);
};

export const insertSession = async (
  env: Env,
  userId: string,
  session: TimeTrackerSessionPayload,
): Promise<TimeTrackerSessionPayload> => {
  const rows = await request<SessionRow[]>(env, 'POST', 'time_tracker_sessions', {
    body: {
      id: session.id,
      user_id: userId,
      title: session.title,
      started_at: session.startedAt,
      ended_at: session.endedAt,
      duration_seconds: session.durationSeconds,
      tags: session.tags && session.tags.length > 0 ? session.tags : null,
      project: session.project ?? null,
      notes: session.notes ?? null,
      updated_at: new Date().toISOString(),
    },
    searchParams: {
      select: 'id,title,started_at,ended_at,duration_seconds,tags,project,notes',
    },
    prefer: 'return=representation',
  });

  return mapSessionRow(rows[0]);
};
