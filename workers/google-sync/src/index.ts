import type { Env } from './env';
import { handleSyncSession } from './handlers/syncSession';

const ROUTES = {
  SYNC: '/integrations/google/sync',
} as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === ROUTES.SYNC) {
      return handleSyncSession(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};
