const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const badRequest = (message: string) =>
  jsonResponse({ error: 'bad_request', message }, 400);

const unauthorized = (message: string) =>
  jsonResponse({ error: 'unauthorized', message }, 401);

const conflict = (code: string, message: string) =>
  jsonResponse({ error: code, message }, 409);

const serverError = (message: string, status = 500) =>
  jsonResponse({ error: 'internal_error', message }, status);

export { jsonResponse, badRequest, unauthorized, conflict, serverError };
