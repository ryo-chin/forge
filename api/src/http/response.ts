const DEFAULT_ALLOWED_ORIGIN = 'https://forge.h031203yama.workers.dev';

const ALLOWED_ORIGINS = new Set([
  DEFAULT_ALLOWED_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

const resolveAllowedOrigin = (origin?: string | null): string => {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return origin;
  }
  return DEFAULT_ALLOWED_ORIGIN;
};

const getCorsHeaders = (origin?: string | null) => {
  return {
    'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

const jsonResponse = (data: unknown, status = 200, origin?: string | null) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });

const badRequest = (message: string, origin?: string | null) =>
  jsonResponse({ error: 'bad_request', message }, 400, origin);

const unauthorized = (message: string, origin?: string | null) =>
  jsonResponse({ error: 'unauthorized', message }, 401, origin);

const conflict = (code: string, message: string, origin?: string | null) =>
  jsonResponse({ error: code, message }, 409, origin);

const serverError = (message: string, status = 500, origin?: string | null) =>
  jsonResponse({ error: 'internal_error', message }, status, origin);

const handleOptions = (request: Request) => {
  const origin = request.headers.get('Origin');
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
};

export {
  jsonResponse,
  badRequest,
  unauthorized,
  conflict,
  serverError,
  handleOptions,
  getCorsHeaders,
};
