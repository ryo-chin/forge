import type {
  RunningSessionState,
  SessionDraft,
  TimeTrackerSession,
} from './types.ts';

// Action
export type RunningSessionAction =
  | { type: 'START'; payload: { id: string; title: string; startedAt: number } }
  | { type: 'TICK'; payload: { nowMs: number } }
  | { type: 'UPDATE_DRAFT'; payload: Partial<Omit<SessionDraft, 'startedAt'>> }
  | { type: 'ADJUST_DURATION'; payload: { deltaSeconds: number; nowMs: number } }
  | { type: 'RESET' }
  | { type: 'RESTORE'; payload: RunningSessionState };

// State
export const initialRunningSessionState: RunningSessionState = {
  status: 'idle',
  draft: null,
  elapsedSeconds: 0,
};

export const runningSessionReducer = (
  state: RunningSessionState,
  action: RunningSessionAction,
): RunningSessionState => {
  switch (action.type) {
    case 'START': {
      const title = action.payload.title.trim();
      if (!title) return state; // 二重防御
      const draft: SessionDraft = {
        id: action.payload.id,
        title,
        startedAt: action.payload.startedAt,
        tags: [],
      };
      return { status: 'running', draft, elapsedSeconds: 0 };
    }

    case 'TICK': {
      if (state.status !== 'running') return state;
      const { nowMs } = action.payload;
      const elapsedSeconds = Math.max(
        0,
        Math.floor((nowMs - state.draft.startedAt) / 1000),
      );
      if (elapsedSeconds === state.elapsedSeconds) return state;
      return { ...state, elapsedSeconds };
    }

    case 'UPDATE_DRAFT': {
      if (state.status !== 'running') return state;
      const patch = { ...action.payload };
      if (typeof patch.title === 'string') patch.title = patch.title.trim();
      if (typeof patch.project === 'string') {
        const t = patch.project.trim();
        patch.project = t ? t : undefined;
      }
      return { ...state, draft: { ...state.draft, ...patch } };
    }

    case 'ADJUST_DURATION': {
      if (state.status !== 'running') return state;
      const { deltaSeconds, nowMs } = action.payload;
      if (deltaSeconds === 0) return state;

      const baseSeconds = Math.max(
        0,
        Math.floor((nowMs - state.draft.startedAt) / 1000),
      );
      const adjustedSeconds = Math.max(0, baseSeconds + deltaSeconds);
      if (adjustedSeconds === baseSeconds) return state;

      const adjustedStartedAtMs = nowMs - adjustedSeconds * 1000;
      return {
        status: 'running',
        draft: { ...state.draft, startedAt: adjustedStartedAtMs },
        elapsedSeconds: adjustedSeconds,
      };
    }

    case 'RESET':
      return initialRunningSessionState;

    case 'RESTORE':
      return action.payload;

    default:
      return state;
  }
};

// Draft → Session
export const createSessionFromDraft = (
  draft: SessionDraft,
  stoppedAtMs: number,
): TimeTrackerSession => {
  const durationSeconds = Math.max(
    1,
    Math.floor((stoppedAtMs - draft.startedAt) / 1000),
  );

  const session: TimeTrackerSession = {
    id: draft.id,  // Running時と同じIDを使用
    title: draft.title.trim(),
    startedAt: draft.startedAt,
    endedAt: stoppedAtMs,
    durationSeconds,
  };

  if (draft.tags?.length) session.tags = draft.tags.slice();
  if (draft.project) session.project = draft.project;
  if (draft.skill) session.skill = draft.skill;
  if (draft.intensity) session.intensity = draft.intensity;
  if (draft.notes) session.notes = draft.notes;

  return session;
};;
