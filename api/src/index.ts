import type { Env } from './env';
import { handleMcp } from './handlers/mcp';
import {
  handleCreateMcpToken,
  handleListMcpTokens,
  handleRevokeMcpToken,
} from './handlers/mcpTokens';
import { handleOauthCallback, handleOauthRevoke, handleOauthStart } from './handlers/oauth';
import {
  handleRunningSessionCancel,
  handleRunningSessionStart,
  handleRunningSessionUpdate,
} from './handlers/runningSessions';
import {
  handleGetSettings,
  handleListSheets,
  handleListSpreadsheets,
  handleUpdateSettings,
} from './handlers/settings';
import { handleDeleteSyncedSession, handleSyncSession } from './handlers/syncSession';
import {
  handleCancelRunningSession,
  handleGetRunningState,
  handleStartRunningSession,
  handleStopRunningSession,
  handleUpdateRunningSession,
} from './handlers/timeTracker';
import { getCorsHeaders, handleOptions } from './http/response';

const ROUTES = {
  SYNC: '/integrations/google/sync',
  SYNC_DELETE: '/integrations/google/sync/delete',
  OAUTH_START: '/integrations/google/oauth/start',
  OAUTH_CALLBACK: '/integrations/google/oauth/callback',
  OAUTH_REVOKE: '/integrations/google/oauth/revoke',
  SETTINGS: '/integrations/google/settings',
  SPREADSHEETS: '/integrations/google/spreadsheets',
  RUNNING_START: '/integrations/google/running/start',
  RUNNING_UPDATE: '/integrations/google/running/update',
  RUNNING_CANCEL: '/integrations/google/running/cancel',
  TIME_TRACKER_RUNNING: '/time-tracker/running',
  TIME_TRACKER_RUNNING_START: '/time-tracker/running/start',
  TIME_TRACKER_RUNNING_UPDATE: '/time-tracker/running/update',
  TIME_TRACKER_RUNNING_STOP: '/time-tracker/running/stop',
  TIME_TRACKER_RUNNING_CANCEL: '/time-tracker/running/cancel',
  MCP: '/mcp',
  MCP_TOKENS: '/mcp/tokens',
} as const;

const withCors = (response: Response, request: Request): Response => {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(getCorsHeaders(request.headers.get('Origin')))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const respond = async (response: Promise<Response>, request: Request): Promise<Response> =>
  withCors(await response, request);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // OAuth routes
    if (request.method === 'POST' && url.pathname === ROUTES.OAUTH_START) {
      return respond(handleOauthStart(request, env), request);
    }
    if (request.method === 'GET' && url.pathname === ROUTES.OAUTH_CALLBACK) {
      return respond(handleOauthCallback(request, env), request);
    }
    if (request.method === 'POST' && url.pathname === ROUTES.OAUTH_REVOKE) {
      return respond(handleOauthRevoke(request, env), request);
    }

    // Settings routes
    if (request.method === 'GET' && url.pathname === ROUTES.SETTINGS) {
      return respond(handleGetSettings(request, env), request);
    }
    if (request.method === 'PUT' && url.pathname === ROUTES.SETTINGS) {
      return respond(handleUpdateSettings(request, env), request);
    }

    // Spreadsheet/Sheet listing routes
    if (request.method === 'GET' && url.pathname === ROUTES.SPREADSHEETS) {
      return respond(handleListSpreadsheets(request, env), request);
    }
    if (
      request.method === 'GET' &&
      url.pathname.startsWith('/integrations/google/spreadsheets/') &&
      url.pathname.endsWith('/sheets')
    ) {
      return respond(handleListSheets(request, env), request);
    }

    // Sync route
    if (request.method === 'POST' && url.pathname === ROUTES.SYNC) {
      return respond(handleSyncSession(request, env), request);
    }

    if (request.method === 'POST' && url.pathname === ROUTES.SYNC_DELETE) {
      return respond(handleDeleteSyncedSession(request, env), request);
    }

    if (request.method === 'POST' && url.pathname === ROUTES.RUNNING_START) {
      return respond(handleRunningSessionStart(request, env), request);
    }

    if (request.method === 'PATCH' && url.pathname === ROUTES.RUNNING_UPDATE) {
      return respond(handleRunningSessionUpdate(request, env), request);
    }

    if (request.method === 'POST' && url.pathname === ROUTES.RUNNING_CANCEL) {
      return respond(handleRunningSessionCancel(request, env), request);
    }

    if (request.method === 'GET' && url.pathname === ROUTES.TIME_TRACKER_RUNNING) {
      return respond(handleGetRunningState(request, env), request);
    }

    if (request.method === 'POST' && url.pathname === ROUTES.TIME_TRACKER_RUNNING_START) {
      return respond(handleStartRunningSession(request, env), request);
    }

    if (request.method === 'PATCH' && url.pathname === ROUTES.TIME_TRACKER_RUNNING_UPDATE) {
      return respond(handleUpdateRunningSession(request, env), request);
    }

    if (request.method === 'POST' && url.pathname === ROUTES.TIME_TRACKER_RUNNING_STOP) {
      return respond(handleStopRunningSession(request, env), request);
    }

    if (request.method === 'POST' && url.pathname === ROUTES.TIME_TRACKER_RUNNING_CANCEL) {
      return respond(handleCancelRunningSession(request, env), request);
    }

    if (request.method === 'POST' && url.pathname === ROUTES.MCP) {
      return respond(handleMcp(request, env), request);
    }

    if (request.method === 'GET' && url.pathname === ROUTES.MCP_TOKENS) {
      return respond(handleListMcpTokens(request, env), request);
    }

    if (request.method === 'POST' && url.pathname === ROUTES.MCP_TOKENS) {
      return respond(handleCreateMcpToken(request, env), request);
    }

    if (request.method === 'DELETE' && url.pathname.startsWith(`${ROUTES.MCP_TOKENS}/`)) {
      const tokenId = decodeURIComponent(url.pathname.slice(`${ROUTES.MCP_TOKENS}/`.length));
      return respond(handleRevokeMcpToken(request, env, tokenId), request);
    }

    return withCors(new Response('Not Found', { status: 404 }), request);
  },
};
