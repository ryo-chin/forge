import type { Env } from '../env';

const AUTH_HEADER = 'authorization';
const BEARER_PREFIX = 'bearer ';

export type SupabaseAuthResult = {
  userId: string;
  email?: string | null;
  raw: unknown;
};

export class SupabaseAuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SupabaseAuthError';
    this.status = status;
  }
}

export const extractBearerToken = (request: Request): string | null => {
  const headerValue = request.headers.get(AUTH_HEADER);
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (trimmed.toLowerCase().startsWith(BEARER_PREFIX)) {
    return trimmed.slice(BEARER_PREFIX.length).trim();
  }
  return null;
};

export const verifySupabaseJwt = async (token: string, env: Env): Promise<SupabaseAuthResult> => {
  if (!token) {
    throw new SupabaseAuthError('Missing bearer token', 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new SupabaseAuthError('Supabase environment is not configured', 500);
  }

  const endpoint = new URL('/auth/v1/user', env.SUPABASE_URL);
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (response.status === 401) {
    throw new SupabaseAuthError('Invalid or expired token', 401);
  }

  if (!response.ok) {
    const body = await safeJson(response);
    throw new SupabaseAuthError(
      `Supabase user lookup failed (${response.status}) ${JSON.stringify(body)}`,
      response.status,
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const userId = typeof payload.id === 'string' ? payload.id : null;

  if (!userId) {
    throw new SupabaseAuthError('Supabase user response missing id', 500);
  }

  return {
    userId,
    email: typeof payload.email === 'string' ? payload.email : null,
    raw: payload,
  };
};

const safeJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
};
