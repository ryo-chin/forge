import type { Env } from './env';
import { handleSyncSession } from './handlers/syncSession';
import {
  handleOauthStart,
  handleOauthCallback,
  handleOauthRevoke,
} from './handlers/oauth';
import {
  handleGetSettings,
  handleUpdateSettings,
  handleListSpreadsheets,
  handleListSheets,
} from './handlers/settings';
import { handleOptions } from './http/response';

const ROUTES = {
  SYNC: '/integrations/google/sync',
  OAUTH_START: '/integrations/google/oauth/start',
  OAUTH_CALLBACK: '/integrations/google/oauth/callback',
  OAUTH_REVOKE: '/integrations/google/oauth/revoke',
  SETTINGS: '/integrations/google/settings',
  SPREADSHEETS: '/integrations/google/spreadsheets',
} as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // OAuth routes
    if (request.method === 'POST' && url.pathname === ROUTES.OAUTH_START) {
      return handleOauthStart(request, env);
    }
    if (request.method === 'GET' && url.pathname === ROUTES.OAUTH_CALLBACK) {
      return handleOauthCallback(request, env);
    }
    if (request.method === 'POST' && url.pathname === ROUTES.OAUTH_REVOKE) {
      return handleOauthRevoke(request, env);
    }

    // Settings routes
    if (request.method === 'GET' && url.pathname === ROUTES.SETTINGS) {
      return handleGetSettings(request, env);
    }
    if (request.method === 'PUT' && url.pathname === ROUTES.SETTINGS) {
      return handleUpdateSettings(request, env);
    }

    // Spreadsheet/Sheet listing routes
    if (request.method === 'GET' && url.pathname === ROUTES.SPREADSHEETS) {
      return handleListSpreadsheets(request, env);
    }
    if (
      request.method === 'GET' &&
      url.pathname.startsWith('/integrations/google/spreadsheets/') &&
      url.pathname.endsWith('/sheets')
    ) {
      return handleListSheets(request, env);
    }

    // Sync route
    if (request.method === 'POST' && url.pathname === ROUTES.SYNC) {
      return handleSyncSession(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};
