export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
}

const ROUTES = {
  SYNC: '/integrations/google/sync',
} as const;

const notImplemented = () =>
  new Response(JSON.stringify({ error: 'not_implemented' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === ROUTES.SYNC) {
      return notImplemented();
    }

    return new Response('Not Found', { status: 404 });
  },
};
