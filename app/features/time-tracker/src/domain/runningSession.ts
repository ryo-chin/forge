import type {
  RunningSessionState,
  SessionDraft,
  TimeTrackerSession,
} from '../types';

export type RunningSessionAction =
  | {
      type: 'START';
      payload: { title: string; startedAt: number };
    }
  | {
      type: 'TICK';
      payload: { now: number };
    }
  | {
      type: 'UPDATE_DRAFT';
      payload: Partial<Omit<SessionDraft, 'startedAt'>>;
    }
  | {
      type: 'ADJUST_DURATION';
      payload: { deltaSeconds: number; now: number };
    }
  | { type: 'RESET' };

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
      const { title, startedAt } = action.payload;
      const draft: SessionDraft = {
        title,
        startedAt,
        tags: [],
      };
      return {
        status: 'running',
        draft,
        elapsedSeconds: 0,
      };
    }
    case 'TICK': {
      if (state.status !== 'running') return state;
      const { now } = action.payload;
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now - state.draft.startedAt) / 1000),
      );
      if (elapsedSeconds === state.elapsedSeconds) {
        return state;
      }
      return {
        ...state,
        elapsedSeconds,
      };
    }
    case 'UPDATE_DRAFT': {
      if (state.status !== 'running') return state;
      const nextDraft: SessionDraft = {
        ...state.draft,
        ...action.payload,
      };
      return {
        ...state,
        draft: nextDraft,
      };
    }
    case 'ADJUST_DURATION': {
      if (state.status !== 'running') return state;
      const { deltaSeconds, now } = action.payload;
      if (deltaSeconds === 0) {
        return state;
      }
      const baseDuration = Math.max(
        0,
        Math.floor((now - state.draft.startedAt) / 1000),
      );
      const adjustedDuration = Math.max(0, baseDuration + deltaSeconds);
      if (adjustedDuration === baseDuration) {
        return state;
      }
      const adjustedStartedAt = now - adjustedDuration * 1000;
      return {
        status: 'running',
        draft: {
          ...state.draft,
          startedAt: adjustedStartedAt,
        },
        elapsedSeconds: adjustedDuration,
      };
    }
    case 'RESET':
      return initialRunningSessionState;
    default:
      return state;
  }
};

export const createSessionFromDraft = (
  draft: SessionDraft,
  stoppedAt: number,
): TimeTrackerSession => {
  const durationSeconds = Math.max(
    1,
    Math.floor((stoppedAt - draft.startedAt) / 1000),
  );

  const session: TimeTrackerSession = {
    id: `${stoppedAt}`,
    title: draft.title,
    startedAt: draft.startedAt,
    endedAt: stoppedAt,
    durationSeconds,
  };

  if (Array.isArray(draft.tags) && draft.tags.length > 0) {
    session.tags = draft.tags;
  }
  if (draft.project) {
    session.project = draft.project;
  }
  if (draft.skill) {
    session.skill = draft.skill;
  }
  if (draft.intensity) {
    session.intensity = draft.intensity;
  }
  if (draft.notes) {
    session.notes = draft.notes;
  }

  return session;
};
