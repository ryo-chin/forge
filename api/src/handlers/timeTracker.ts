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
  TimeTrackerRepositoryError,
  upsertRunningState,
} from '../repositories/timeTracker';
import type {
  RunningSessionCancelRequest,
  RunningSessionDraftPayload,
  RunningSessionStatePayload,
  RunningSessionStopRequest,
  RunningSessionUpdateRequest,
  TimeTrackerSessionPayload,
} from '../types';
import { handleSyncSession } from './syncSession';

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

const validateDraft = (draft: unknown): RunningSessionDraftPayload => {
  const value = asObject(draft);
  if (!value) {
    throw new HttpResponseError(badRequest('draft is required'));
  }

  const startedAt = validateString(value.startedAt, 'draft.startedAt');
  if (Number.isNaN(new Date(startedAt).getTime())) {
    throw new HttpResponseError(badRequest('draft.startedAt must be a valid date string'));
  }

  const tags = value.tags;
  if (tags !== undefined && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string'))) {
    throw new HttpResponseError(badRequest('draft.tags must be an array of strings'));
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
  if (Array.isArray(tags)) {
    normalized.tags = tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  }

  return normalized;
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

const syncCompletedSession = async (
  request: Request,
  env: Env,
  session: TimeTrackerSessionPayload,
): Promise<CompletedSessionSyncResult> => {
  const token = extractBearerToken(request);
  if (!token) {
    return { status: 'skipped', reason: 'Bearer token is required' };
  }

  try {
    const syncUrl = new URL('/integrations/google/sync', request.url);
    const syncResponse = await handleSyncSession(
      new Request(syncUrl.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session,
          source: 'time-tracker-worker-api',
        }),
      }),
      env,
    );
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

export const handleGetRunningState = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const state = (await getRunningState(env, auth.userId)) ?? idleState;

    return jsonResponse({ state });
  } catch (responseOrError) {
    return handleError(responseOrError);
  }
};

export const handleStartRunningSession = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const payload = await parseJson<{ draft?: unknown }>(request);
    const draft = validateDraft(payload.draft);
    const currentState = await getRunningState(env, auth.userId);

    if (currentState?.status === 'running') {
      if (currentState.draft.id === draft.id) {
        return jsonResponse({ state: currentState });
      }
      throw new HttpResponseError(conflict('already_running', 'A running session already exists'));
    }

    const state: RunningSessionStatePayload = {
      status: 'running',
      draft,
      elapsedSeconds: 0,
    };
    const savedState = await upsertRunningState(env, auth.userId, state);

    return jsonResponse({ state: savedState }, 201);
  } catch (responseOrError) {
    return handleError(responseOrError);
  }
};

export const handleUpdateRunningSession = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const payload = await parseJson<RunningSessionUpdateRequest>(request);
    const draft = validateDraft(payload.draft);
    const elapsedSeconds = validateElapsedSeconds(payload.elapsedSeconds);
    const currentState = requireCurrentRunning(await getRunningState(env, auth.userId));
    ensureSessionIdMatches(currentState, draft.id);

    const state: RunningSessionStatePayload = {
      status: 'running',
      draft,
      elapsedSeconds,
    };
    const savedState = await upsertRunningState(env, auth.userId, state);

    return jsonResponse({ state: savedState });
  } catch (responseOrError) {
    return handleError(responseOrError);
  }
};

export const handleStopRunningSession = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const payload = await parseJson<RunningSessionStopRequest>(request);
    const currentState = requireCurrentRunning(await getRunningState(env, auth.userId));
    ensureSessionIdMatches(currentState, payload.id);

    const stoppedAt = parseStoppedAt(payload.stoppedAt);
    const session = buildCompletedSession(currentState.draft, stoppedAt);
    const savedSession = await insertSession(env, auth.userId, session);
    const savedState = await upsertRunningState(env, auth.userId, idleState);
    const sync = await syncCompletedSession(request, env, savedSession);

    return jsonResponse({ session: savedSession, state: savedState, sync });
  } catch (responseOrError) {
    return handleError(responseOrError);
  }
};

export const handleCancelRunningSession = async (request: Request, env: Env): Promise<Response> => {
  try {
    const auth = await ensureAuthorized(request, env);
    const payload = await parseJson<RunningSessionCancelRequest>(request);
    const currentState = await getRunningState(env, auth.userId);

    if (!currentState || currentState.status === 'idle') {
      return jsonResponse({ state: idleState });
    }
    ensureSessionIdMatches(currentState, payload.id);

    const savedState = await upsertRunningState(env, auth.userId, idleState);

    return jsonResponse({ state: savedState });
  } catch (responseOrError) {
    return handleError(responseOrError);
  }
};
