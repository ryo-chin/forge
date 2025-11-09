import type {
  RunningSessionState,
  SessionDraft,
  TimeTrackerSession,
} from './types.ts';

// Action
export type RunningSessionAction =
  | {
      type: 'START';
      payload: {
        title: string;
        startedAt: number;
        project?: string | null;
        projectId?: string | null;
        themeId?: string | null;
        classificationPath?: string[];
        id?: string | null;
      };
    }
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
      const trimmedProject =
        typeof action.payload.project === 'string'
          ? action.payload.project.trim()
          : undefined;
      const normalizedThemeId =
        typeof action.payload.themeId === 'string'
          ? action.payload.themeId.trim() || null
          : null;
      const normalizedProjectId =
        typeof action.payload.projectId === 'string'
          ? action.payload.projectId.trim() || null
          : null;
      const normalizedClassificationPath = Array.isArray(
        action.payload.classificationPath,
      )
        ? action.payload.classificationPath
            .map((segment) =>
              typeof segment === 'string' ? segment.trim() : '',
            )
            .filter(Boolean)
        : undefined;
      const draft: SessionDraft = {
        id:
          action.payload.id && action.payload.id.trim().length > 0
            ? action.payload.id
            : crypto.randomUUID(),
        title,
        startedAt: action.payload.startedAt,
        tags: [],
        project: trimmedProject ? trimmedProject : undefined,
        themeId: normalizedThemeId,
        projectId: normalizedProjectId,
      };
      if (normalizedClassificationPath?.length) {
        draft.classificationPath = normalizedClassificationPath;
      }
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
      if ('themeId' in patch) {
        if (
          typeof patch.themeId === 'string' &&
          patch.themeId.trim().length > 0
        ) {
          patch.themeId = patch.themeId.trim();
        } else {
          patch.themeId = null;
        }
      }
      if ('projectId' in patch) {
        if (
          typeof patch.projectId === 'string' &&
          patch.projectId.trim().length > 0
        ) {
          patch.projectId = patch.projectId.trim();
        } else {
          patch.projectId = null;
        }
      }
      if ('classificationPath' in patch && Array.isArray(patch.classificationPath)) {
        patch.classificationPath = patch.classificationPath
          .map((segment) =>
            typeof segment === 'string' ? segment.trim() : '',
          )
          .filter(Boolean);
        if (patch.classificationPath.length === 0) {
          delete patch.classificationPath;
        }
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
  if (draft.projectId) session.projectId = draft.projectId;
  if (draft.themeId) session.themeId = draft.themeId;
  if (draft.classificationPath?.length) {
    session.classificationPath = [...draft.classificationPath];
  } else {
    const path: string[] = [];
    if (draft.themeId) path.push(draft.themeId);
    if (draft.projectId) path.push(draft.projectId);
    if (path.length) {
      session.classificationPath = path;
    }
  }
  if (draft.skill) session.skill = draft.skill;
  if (draft.intensity) session.intensity = draft.intensity;
  if (draft.notes) session.notes = draft.notes;

  return session;
};
