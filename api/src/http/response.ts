const getCorsHeaders = () => {
  // 開発環境では全てのオリジンを許可
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(),
    },
  });

const badRequest = (message: string) => jsonResponse({ error: 'bad_request', message }, 400);

const unauthorized = (message: string) => jsonResponse({ error: 'unauthorized', message }, 401);

const conflict = (code: string, message: string) => jsonResponse({ error: code, message }, 409);

const serverError = (message: string, status = 500) =>
  jsonResponse({ error: 'internal_error', message }, status);

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
