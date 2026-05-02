import {
  extractBearerToken,
  SupabaseAuthError,
  verifySupabaseJwt,
} from '../auth/verifySupabaseJwt';
import type { Env } from '../env';
import { badRequest, conflict, jsonResponse, serverError, unauthorized } from '../http/response';
import {
  getRunningState,
  insertSession,
  listSessions,
  TimeTrackerRepositoryError,
  upsertRunningState,
} from '../repositories/timeTracker';
import type {
  RunningSessionCancelRequest,
  RunningSessionDraftPayload,
  RunningSessionStartRequest,
  RunningSessionStatePayload,
  RunningSessionStopRequest,
  RunningSessionUpdateRequest,
  TimeTrackerSessionListRequest,
  TimeTrackerSessionPayload,
  TimeTrackerSessionRecordRequest,
} from '../types';
import { syncSessionForUser } from './syncSession';

class HttpResponseError extends Error {
  readonly response: Response;

  constructor(response: Response) {
    super(`HTTP ${response.status}`);
    this.response = response;
  }
}

const idleState: RunningSessionStatePayload = {
  status: 'idle',
  draft: null,
  elapsedSeconds: 0,
};

const ensureAuthorized = async (request: Request, env: Env) => {
  const token = extractBearerToken(request);
  if (!token) {
    throw new HttpResponseError(unauthorized('Bearer token is required'));
  }

  try {
    return await verifySupabaseJwt(token, env);
  } catch (error) {
    if (error instanceof SupabaseAuthError) {
      throw new HttpResponseError(unauthorized(error.message));
    }
    throw new HttpResponseError(unauthorized('Invalid token'));
  }
};

const parseJson = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T;
  } catch (error) {
    throw new HttpResponseError(
      badRequest(error instanceof Error ? error.message : 'Invalid request body'),
    );
  }
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const validateString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpResponseError(badRequest(`${field} is required`));
  }
  return value.trim();
};

const validateOptionalString = (value: unknown, field: string): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new HttpResponseError(badRequest(`${field} must be a string`));
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const validateOptionalTags = (value: unknown, field: string): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string')) {
    throw new HttpResponseError(badRequest(`${field} must be an array of strings`));
  }
  return value.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
};

const parseDateField = (value: unknown, field: string): string => {
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new HttpResponseError(badRequest(`${field} must be a valid date string or timestamp`));
    }
    return date.toISOString();
  }
  throw new HttpResponseError(badRequest(`${field} must be a date string or timestamp`));
};

const parseOptionalDateField = (value: unknown, field: string): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return parseDateField(value, field);
};

const validateDraft = (draft: unknown): RunningSessionDraftPayload => {
  const value = asObject(draft);
  if (!value) {
    throw new HttpResponseError(badRequest('draft is required'));
  }

  const startedAt = validateString(value.startedAt, 'draft.startedAt');
  if (Number.isNaN(new Date(startedAt).getTime())) {
    throw new HttpResponseError(badRequest('draft.startedAt must be a valid date string'));
  }

  const normalized: RunningSessionDraftPayload = {
    id: validateString(value.id, 'draft.id'),
    title: validateString(value.title, 'draft.title'),
    startedAt,
  };

  const project = validateOptionalString(value.project, 'draft.project');
  if (project !== undefined) normalized.project = project;
  const skill = validateOptionalString(value.skill, 'draft.skill');
  if (skill !== undefined) normalized.skill = skill;
  const intensity = validateOptionalString(value.intensity, 'draft.intensity');
  if (intensity !== undefined) normalized.intensity = intensity;
  const notes = validateOptionalString(value.notes, 'draft.notes');
  if (notes !== undefined) normalized.notes = notes;
  const tags = validateOptionalTags(value.tags, 'draft.tags');
  if (tags !== undefined) normalized.tags = tags;

  return normalized;
};

const validateListLimit = (value: unknown): number => {
  if (value === undefined || value === null) return 10;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpResponseError(badRequest('limit must be a number'));
  }
  const limit = Math.floor(value);
  if (limit < 1 || limit > 50) {
    throw new HttpResponseError(badRequest('limit must be between 1 and 50'));
  }
  return limit;
};

const validateElapsedSeconds = (elapsedSeconds: unknown): number => {
  if (typeof elapsedSeconds !== 'number' || Number.isNaN(elapsedSeconds) || elapsedSeconds < 0) {
    throw new HttpResponseError(badRequest('elapsedSeconds must be a non-negative number'));
  }
  return Math.floor(elapsedSeconds);
};

const requireCurrentRunning = (
  state: RunningSessionStatePayload | null,
): Extract<RunningSessionStatePayload, { status: 'running' }> => {
  if (!state || state.status !== 'running') {
    throw new HttpResponseError(conflict('no_running_session', 'No running session exists'));
  }
  return state;
};

const ensureSessionIdMatches = (
  state: Extract<RunningSessionStatePayload, { status: 'running' }>,
  expectedId?: string,
) => {
  if (expectedId && state.draft.id !== expectedId) {
    throw new HttpResponseError(
      conflict('running_session_mismatch', 'Running session id does not match'),
    );
  }
};

const parseStoppedAt = (value: unknown): string => {
  if (value === undefined || value === null) {
    return new Date().toISOString();
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new HttpResponseError(badRequest('stoppedAt must be a valid timestamp'));
    }
    return date.toISOString();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new HttpResponseError(badRequest('stoppedAt must be a valid date string'));
    }
    return date.toISOString();
  }
  throw new HttpResponseError(badRequest('stoppedAt must be a date string or timestamp'));
};

const buildCompletedSession = (
  draft: RunningSessionDraftPayload,
  stoppedAt: string,
): TimeTrackerSessionPayload => {
  const startedAtMs = new Date(draft.startedAt).getTime();
  const stoppedAtMs = new Date(stoppedAt).getTime();
  const durationSeconds = Math.max(1, Math.floor((stoppedAtMs - startedAtMs) / 1000));

  const session: TimeTrackerSessionPayload = {
    id: draft.id,
    title: draft.title,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: stoppedAt,
    durationSeconds,
  };

  if (draft.project) session.project = draft.project;
  if (draft.notes) session.notes = draft.notes;
  if (draft.tags?.length) session.tags = draft.tags;
  if (draft.skill) session.skill = draft.skill;
  if (draft.intensity) session.intensity = draft.intensity;

  return session;
};

const withLiveElapsedSeconds = (state: RunningSessionStatePayload): RunningSessionStatePayload => {
  if (state.status !== 'running') {
    return state;
  }
  const startedAtMs = new Date(state.draft.startedAt).getTime();
  if (Number.isNaN(startedAtMs)) {
    return state;
  }
  return {
    ...state,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)),
  };
};

const applyStopOverrides = (
  draft: RunningSessionDraftPayload,
  payload: RunningSessionStopRequest,
): RunningSessionDraftPayload => {
  const nextDraft: RunningSessionDraftPayload = { ...draft };

  if (payload.title !== undefined) {
    nextDraft.title = validateString(payload.title, 'title');
  }

  const project = validateOptionalString(payload.project, 'project');
  if (project !== undefined) nextDraft.project = project;
  const notes = validateOptionalString(payload.notes, 'notes');
  if (notes !== undefined) nextDraft.notes = notes;
  const skill = validateOptionalString(payload.skill, 'skill');
  if (skill !== undefined) nextDraft.skill = skill;
  const intensity = validateOptionalString(payload.intensity, 'intensity');
  if (intensity !== undefined) nextDraft.intensity = intensity;
  const tags = validateOptionalTags(payload.tags, 'tags');
  if (tags !== undefined) nextDraft.tags = tags;

  return nextDraft;
};

const buildRecordSession = (
  payload: TimeTrackerSessionRecordRequest,
): { session: TimeTrackerSessionPayload; warnings: string[]; dryRun: boolean } => {
  const title = validateString(payload.title, 'title');
  const startedAt = parseDateField(payload.startedAt, 'startedAt');
  const endedAt = parseDateField(payload.endedAt, 'endedAt');
  const startedAtMs = new Date(startedAt).getTime();
  const endedAtMs = new Date(endedAt).getTime();
  if (startedAtMs >= endedAtMs) {
    throw new HttpResponseError(badRequest('startedAt must be before endedAt'));
  }
  if (endedAtMs > Date.now()) {
    throw new HttpResponseError(badRequest('endedAt must not be in the future'));
  }

  const durationSeconds = Math.floor((endedAtMs - startedAtMs) / 1000);
  const warnings: string[] = [];
  if (durationSeconds > 12 * 60 * 60) {
    warnings.push('duration_exceeds_12_hours');
  }

  const session: TimeTrackerSessionPayload = {
    id: validateOptionalString(payload.id, 'id') ?? crypto.randomUUID(),
    title,
    startedAt,
    endedAt,
    durationSeconds,
  };

  const project = validateOptionalString(payload.project, 'project');
  if (project !== undefined) session.project = project;
  const notes = validateOptionalString(payload.notes, 'notes');
  if (notes !== undefined) session.notes = notes;
  const skill = validateOptionalString(payload.skill, 'skill');
  if (skill !== undefined) session.skill = skill;
  const intensity = validateOptionalString(payload.intensity, 'intensity');
  if (intensity !== undefined) session.intensity = intensity;
  const tags = validateOptionalTags(payload.tags, 'tags');
  if (tags !== undefined) session.tags = tags;

  return { session, warnings, dryRun: payload.dryRun === true };
};

type CompletedSessionSyncResult =
  | {
      status: 'success';
      log: unknown;
    }
  | {
      status: 'skipped';
      reason: string;
      detail?: unknown;
    }
  | {
      status: 'failed';
      statusCode: number;
      error: string;
      detail?: unknown;
    };

const skippedSyncErrors = new Set([
  'connection_missing',
  'connection_inactive',
  'selection_missing',
  'mapping_missing',
  'mapping_incomplete',
]);

const readResponseBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

const describeSyncError = (detail: unknown, fallback: string): string => {
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }
  if (typeof detail === 'string' && detail.trim().length > 0) {
    return detail;
  }
  return fallback;
};

export type TimeTrackerOperationResult = {
  body: unknown;
  status?: number;
};

const syncCompletedSession = async (
  env: Env,
  userId: string,
  session: TimeTrackerSessionPayload,
): Promise<CompletedSessionSyncResult> => {
  try {
    const syncResponse = await syncSessionForUser(env, userId, {
      session,
      source: 'time-tracker-worker-api',
    });
    const detail = await readResponseBody(syncResponse);

    if (syncResponse.ok) {
      return { status: 'success', log: detail };
    }

    const errorCode =
      detail && typeof detail === 'object' && 'error' in detail
        ? (detail as { error?: unknown }).error
        : null;
    const reason = describeSyncError(
      detail,
      `Google sync failed with status ${syncResponse.status}`,
    );

    if (typeof errorCode === 'string' && skippedSyncErrors.has(errorCode)) {
      return { status: 'skipped', reason, detail };
    }

    return {
      status: 'failed',
      statusCode: syncResponse.status,
      error: reason,
      detail,
    };
  } catch (error) {
    return {
      status: 'failed',
      statusCode: 500,
      error: error instanceof Error ? error.message : 'Unknown Google sync error',
    };
  }
};

const handleError = (responseOrError: unknown): Response => {
  if (responseOrError instanceof HttpResponseError) {
    return responseOrError.response;
  }
  if (responseOrError instanceof TimeTrackerRepositoryError) {
    return serverError(
      responseOrError.message,
      responseOrError.status >= 500 ? 502 : responseOrError.status,
    );
  }
  if (responseOrError instanceof Error) {
    return serverError(responseOrError.message, 500);
  }
  return serverError('Unknown error', 500);
};

export const getRunningStateForUser = async (
  env: Env,
  userId: string,
): Promise<TimeTrackerOperationResult> => {
  const state = (await getRunningState(env, userId)) ?? idleState;
  return { body: { state: withLiveElapsedSeconds(state) } };
};

export const listSessionsForUser = async (
  env: Env,
  userId: string,
  payload: TimeTrackerSessionListRequest,
): Promise<TimeTrackerOperationResult> => {
  const sessions = await listSessions(env, userId, {
    limit: validateListLimit(payload.limit),
    from: parseOptionalDateField(payload.from, 'from'),
    to: parseOptionalDateField(payload.to, 'to'),
    query: validateOptionalString(payload.query, 'query') ?? undefined,
    project: validateOptionalString(payload.project, 'project') ?? undefined,
    tags: validateOptionalTags(payload.tags, 'tags'),
  });
  return { body: { sessions } };
};

export const startRunningSessionForUser = async (
  env: Env,
  userId: string,
  payload: { draft?: unknown },
): Promise<TimeTrackerOperationResult> => {
  const draft = validateDraft(payload.draft);
  const currentState = await getRunningState(env, userId);

  if (currentState?.status === 'running') {
    if (currentState.draft.id === draft.id) {
      return { body: { state: currentState } };
    }
    throw new HttpResponseError(conflict('already_running', 'A running session already exists'));
  }

  const state: RunningSessionStatePayload = {
    status: 'running',
    draft,
    elapsedSeconds: 0,
  };
  const savedState = await upsertRunningState(env, userId, state);

  return { body: { state: savedState }, status: 201 };
};

export const updateRunningSessionForUser = async (
  env: Env,
  userId: string,
  payload: RunningSessionUpdateRequest,
): Promise<TimeTrackerOperationResult> => {
  const draft = validateDraft(payload.draft);
  const elapsedSeconds = validateElapsedSeconds(payload.elapsedSeconds);
  const currentState = requireCurrentRunning(await getRunningState(env, userId));
  ensureSessionIdMatches(currentState, draft.id);

  const state: RunningSessionStatePayload = {
    status: 'running',
    draft,
    elapsedSeconds,
  };
  const savedState = await upsertRunningState(env, userId, state);

  return { body: { state: savedState } };
};

export const stopRunningSessionForUser = async (
  env: Env,
  userId: string,
  payload: RunningSessionStopRequest,
): Promise<TimeTrackerOperationResult> => {
  const currentState = requireCurrentRunning(await getRunningState(env, userId));
  ensureSessionIdMatches(currentState, payload.id);

  const stoppedAt = parseStoppedAt(payload.stoppedAt);
  const session = buildCompletedSession(applyStopOverrides(currentState.draft, payload), stoppedAt);
  const savedSession = await insertSession(env, userId, session);
  const savedState = await upsertRunningState(env, userId, idleState);
  const sync = await syncCompletedSession(env, userId, savedSession);

  return { body: { session: savedSession, state: savedState, sync } };
};

export const recordSessionForUser = async (
  env: Env,
  userId: string,
  payload: TimeTrackerSessionRecordRequest,
): Promise<TimeTrackerOperationResult> => {
  const { session, warnings, dryRun } = buildRecordSession(payload);
  if (dryRun) {
    return {
      body: {
        session,
        dryRun: true,
        warnings,
        sync: { status: 'skipped', reason: 'dry_run' },
      },
    };
  }

  const savedSession = await insertSession(env, userId, session);
  const sync = await syncCompletedSession(env, userId, savedSession);
  return { body: { session: savedSession, warnings, sync }, status: 201 };
};

export const cancelRunningSessionForUser = async (
  env: Env,
  userId: string,
  payload: RunningSessionCancelRequest,
): Promise<TimeTrackerOperationResult> => {
  const currentState = await getRunningState(env, userId);

  if (!currentState || currentState.status === 'idle') {
    return { body: { state: idleState } };
  }
  ensureSessionIdMatches(currentState, payload.id);

  const savedState = await upsertRunningState(env, userId, idleState);

  return { body: { state: savedState } };
};

export const handleGetRunningState = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const result = await getRunningStateForUser(env, auth.userId);

    return jsonResponse(result.body, result.status);
  } catch (responseOrError) {
    return handleError(responseOrError);
  }
};

export const handleStartRunningSession = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const payload = await parseJson<RunningSessionStartRequest>(request);
    const result = await startRunningSessionForUser(env, auth.userId, payload);

    return jsonResponse(result.body, result.status);
  } catch (responseOrError) {
    return handleError(responseOrError);
  }
};

export const handleUpdateRunningSession = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const payload = await parseJson<RunningSessionUpdateRequest>(request);
    const result = await updateRunningSessionForUser(env, auth.userId, payload);

    return jsonResponse(result.body, result.status);
  } catch (responseOrError) {
    return handleError(responseOrError);
  }
};

export const handleStopRunningSession = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const payload = await parseJson<RunningSessionStopRequest>(request);
    const result = await stopRunningSessionForUser(env, auth.userId, payload);

    return jsonResponse(result.body, result.status);
  } catch (responseOrError) {
    return handleError(responseOrError);
  }
};

export const handleCancelRunningSession = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const payload = await parseJson<RunningSessionCancelRequest>(request);
    const result = await cancelRunningSessionForUser(env, auth.userId, payload);

    return jsonResponse(result.body, result.status);
  } catch (responseOrError) {
    return handleError(responseOrError);
  }
};
