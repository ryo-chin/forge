import { getSupabaseClient } from '@infra/supabase';
import type {
  RunningSessionState,
  SessionDraft,
  TimeTrackerSession,
} from '../../../features/time-tracker/domain/types.ts';
import type { CreateDataSourceOptions, TimeTrackerDataSource } from './types.ts';

const SESSIONS_TABLE = 'time_tracker_sessions';
const RUNNING_STATE_TABLE = 'time_tracker_running_states';

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

type StoredSessionDraft = Omit<SessionDraft, 'startedAt'> & {
  startedAt: number | string;
};

type RunningStateRow = {
  status: 'idle' | 'running';
  elapsed_seconds: number | null;
  draft: StoredSessionDraft | null;
};

const mapRowToSession = (row: SessionRow): TimeTrackerSession => {
  const session: TimeTrackerSession = {
    id: row.id,
    title: row.title,
    startedAt: new Date(row.started_at).getTime(),
    endedAt: new Date(row.ended_at).getTime(),
    durationSeconds: row.duration_seconds ?? 0,
  };

  if (Array.isArray(row.tags) && row.tags.length > 0) {
    session.tags = row.tags as string[];
  }
  if (row.project) session.project = row.project;
  if (row.notes) session.notes = row.notes;

  return session;
};

const mapSessionToRow = (session: TimeTrackerSession, userId: string) => ({
  id: session.id,
  user_id: userId,
  title: session.title,
  started_at: new Date(session.startedAt).toISOString(),
  ended_at: new Date(session.endedAt).toISOString(),
  duration_seconds: session.durationSeconds,
  tags: session.tags ?? null,
  project: session.project ?? null,
  notes: session.notes ?? null,
});

const mapRowToRunningState = (row: RunningStateRow | null): RunningSessionState | null => {
  if (!row) return null;

  if (row.status !== 'running') {
    return { status: 'idle', draft: null, elapsedSeconds: 0 };
  }

  const rawDraft = row.draft;
  if (!rawDraft) {
    return { status: 'idle', draft: null, elapsedSeconds: 0 };
  }

  const draft: SessionDraft = {
    ...rawDraft,
    startedAt:
      typeof rawDraft.startedAt === 'string'
        ? new Date(rawDraft.startedAt).getTime()
        : rawDraft.startedAt,
  };

  return {
    status: 'running',
    draft,
    elapsedSeconds: row.elapsed_seconds ?? 0,
  };
};

const mapRunningStateToRow = (state: RunningSessionState, userId: string) => ({
  user_id: userId,
  status: state.status,
  elapsed_seconds: state.elapsedSeconds,
  draft:
    state.status === 'running'
      ? {
          ...state.draft,
          startedAt: new Date(state.draft.startedAt).toISOString(),
        }
      : null,
});

export const createSupabaseDataSource = (
  options: CreateDataSourceOptions = {},
): TimeTrackerDataSource => {
  const supabase = getSupabaseClient();

  const resolveUserId = async (): Promise<string | null> => {
    if (options.userId) {
      return options.userId;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return null;
    }
    return data.user?.id ?? null;
  };

  return {
    mode: 'supabase',
    initialSessions: [],
    initialRunningState: null,
    fetchSessions: async () => {
      const userId = await resolveUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from(SESSIONS_TABLE)
        .select('id, title, started_at, ended_at, duration_seconds, tags, project, notes')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });
      if (error) {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.error('[supabase] Failed to fetch sessions', error.message);
        }
        return [];
      }
      const rows = (data ?? []) as SessionRow[];
      return rows.map(mapRowToSession);
    },
    fetchRunningState: async () => {
      const userId = await resolveUserId();
      if (!userId) return null;
      const { data, error } = await supabase
        .from(RUNNING_STATE_TABLE)
        .select('status, elapsed_seconds, draft')
        .eq('user_id', userId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.warn('[supabase] Failed to fetch running state', error.message);
        }
        return null;
      }
      return mapRowToRunningState((data as RunningStateRow | null) ?? null);
    },
    persistSessions: async (sessions) => {
      const userId = await resolveUserId();
      if (!userId) return;

      const upsertRows = sessions.map((session) => mapSessionToRow(session, userId));

      if (upsertRows.length > 0) {
        const { error: upsertError } = await supabase
          .from(SESSIONS_TABLE)
          .upsert(upsertRows, { onConflict: 'id' });
        if (upsertError) {
          throw upsertError;
        }
      }

      const { data: existingRows, error: existingError } = await supabase
        .from(SESSIONS_TABLE)
        .select('id')
        .eq('user_id', userId);
      if (existingError) {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.warn('[supabase] Failed to load current session ids', existingError.message);
        }
        return;
      }

      const targetIds = new Set(upsertRows.map((row) => row.id));
      const idsToDelete = (existingRows ?? [])
        .map((row) => row.id as string)
        .filter((id) => !targetIds.has(id));

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from(SESSIONS_TABLE)
          .delete()
          .eq('user_id', userId)
          .in('id', idsToDelete);
        if (deleteError) {
          throw deleteError;
        }
      }
    },
    persistRunningState: async (state) => {
      const userId = await resolveUserId();
      if (!userId) return;

      const row = mapRunningStateToRow(state, userId);
      const { error } = await supabase
        .from(RUNNING_STATE_TABLE)
        .upsert(row, { onConflict: 'user_id' });
      if (error) {
        throw error;
      }
    },
  };
};
