const STORAGE_KEY_SESSIONS = 'codex-time-tracker/sessions';
const STORAGE_KEY_RUNNING = 'codex-time-tracker/running';

export const loadStoredSessions = <T>(
  parse: (value: unknown) => T | null,
): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => parse(entry))
      .filter((entry): entry is T => entry !== null);
  } catch (error) {
    console.warn('Failed to load stored sessions', error);
    return [];
  }
};

export const saveSessions = <T>(sessions: T[]) => {
  if (typeof window === 'undefined') return;
  try {
    if (sessions.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY_SESSIONS);
    } else {
      window.localStorage.setItem(
        STORAGE_KEY_SESSIONS,
        JSON.stringify(sessions),
      );
    }
  } catch (error) {
    console.warn('Failed to persist sessions', error);
  }
};

type RunningStatePayload<Draft> =
  | {
      status: 'running';
      draft: Draft;
    }
  | {
      status: 'idle';
      draft?: null;
    };

export const loadStoredRunningState = <Draft>(
  parseDraft: (value: unknown) => Draft | null,
  now: () => number,
): { draft: Draft; elapsedSeconds: number } | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RUNNING);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunningStatePayload<Draft>;
    if (!parsed || parsed.status !== 'running') return null;
    const draft = parseDraft(parsed.draft);
    if (!draft) return null;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now() - (draft as { startedAt: number }).startedAt) / 1000),
    );
    return { draft, elapsedSeconds };
  } catch (error) {
    console.warn('Failed to load running session', error);
    return null;
  }
};

export const saveRunningState = <Draft>(state: RunningStatePayload<Draft>) => {
  if (typeof window === 'undefined') return;
  try {
    if (state.status === 'running') {
      window.localStorage.setItem(
        STORAGE_KEY_RUNNING,
        JSON.stringify({ status: 'running', draft: state.draft }),
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEY_RUNNING);
    }
  } catch (error) {
    console.warn('Failed to persist running session', error);
  }
};
