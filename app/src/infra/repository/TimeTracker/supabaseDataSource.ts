import type {
  RunningSessionState,
  SessionDraft,
  TimeTrackerSession,
} from '@features/time-tracker';
import { getSupabaseClient } from '@infra/supabase';
import type { Database } from '@infra/supabase';
import type {
  CreateDataSourceOptions,
  TimeTrackerDataSource,
} from './types.ts';

const SESSIONS_TABLE = 'time_tracker_sessions' as const;
const RUNNING_STATE_TABLE = 'time_tracker_running_states' as const;

type SessionRow =
  Database['public']['Tables']['time_tracker_sessions']['Row'];
type SessionInsertRow =
  Database['public']['Tables']['time_tracker_sessions']['Insert'];
type SessionIdRow = Pick<SessionRow, 'id'>;

type StoredSessionDraft = Omit<SessionDraft, 'startedAt'> & {
  startedAt: number | string;
};

type DbRunningStateRow =
  Database['public']['Tables']['time_tracker_running_states']['Row'];
type RunningStateRow = Omit<DbRunningStateRow, 'draft'> & {
  draft: StoredSessionDraft | null;
};
type RunningStateInsert =
  Database['public']['Tables']['time_tracker_running_states']['Insert'] & {
    draft?: StoredSessionDraft | null;
  };

const mapRowToSession = (row: SessionRow): TimeTrackerSession => {
  const session: TimeTrackerSession = {
    id: row.id,
    title: row.title,
    startedAt: new Date(row.started_at).getTime(),
    endedAt: new Date(row.ended_at).getTime(),
    durationSeconds: row.duration_seconds,
  };

  if (row.tags?.length) {
    session.tags = [...row.tags];
  }
  if (row.project) session.project = row.project;
  if (row.project_id) session.projectId = row.project_id;
  if (row.theme_id) session.themeId = row.theme_id;
  if (row.classification_path?.length) {
    session.classificationPath = [...row.classification_path];
  }
  if (row.notes) session.notes = row.notes;

  return session;
};

const mapSessionToRow = (
  session: TimeTrackerSession,
  userId: string,
): SessionInsertRow => ({
  id: session.id,
  user_id: userId,
  title: session.title,
  started_at: new Date(session.startedAt).toISOString(),
  ended_at: new Date(session.endedAt).toISOString(),
  duration_seconds: session.durationSeconds,
  tags: session.tags ?? null,
  project: session.project ?? null,
  project_id: session.projectId ?? null,
  theme_id: session.themeId ?? null,
  classification_path:
    session.classificationPath && session.classificationPath.length > 0
      ? session.classificationPath
      : null,
  notes: session.notes ?? null,
});

const mapRowToRunningState = (
  row: RunningStateRow | null,
): RunningSessionState | null => {
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

const mapRunningStateToRow = (
  state: RunningSessionState,
  userId: string,
): RunningStateInsert => {
  const nowIso = new Date().toISOString();
  if (state.status === 'idle') {
    return {
      user_id: userId,
      status: 'idle',
      elapsed_seconds: 0,
      draft: null,
      updated_at: nowIso,
    };
  }

  const storedDraft: StoredSessionDraft = {
    ...state.draft,
    startedAt: new Date(state.draft.startedAt).toISOString(),
  };

  return {
    user_id: userId,
    status: 'running',
    elapsed_seconds: state.elapsedSeconds,
    draft: storedDraft,
    updated_at: nowIso,
  };
};

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
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .overrideTypes<SessionRow[]>();
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
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
        .overrideTypes<RunningStateRow | null>();
      if (error && error.code !== 'PGRST116') {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.warn(
            '[supabase] Failed to fetch running state',
            error.message,
          );
        }
        return null;
      }
      return mapRowToRunningState((data as RunningStateRow | null) ?? null);
    },
    persistSessions: async (sessions) => {
      const userId = await resolveUserId();
      if (!userId) return;

      const upsertRows: SessionInsertRow[] = sessions.map((session) =>
        mapSessionToRow(session, userId),
      );

      if (upsertRows.length > 0) {
        const { error: upsertError } = await supabase
          .from(SESSIONS_TABLE)
          .upsert(upsertRows, { onConflict: 'id' });
        if (upsertError) {
          throw upsertError;
        }
      }

      const {
        data: existingRows,
        error: existingError,
      } = await supabase
        .from(SESSIONS_TABLE)
        .select('id')
        .eq('user_id', userId)
        .overrideTypes<SessionIdRow[]>();
      if (existingError) {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.warn(
            '[supabase] Failed to load current session ids',
            existingError.message,
          );
        }
        return;
      }

      const targetIds = new Set(upsertRows.map((row) => row.id));
      const idsToDelete = ((existingRows ?? []) as SessionIdRow[])
        .map((row) => row.id)
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
