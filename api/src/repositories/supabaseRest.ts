import type { Env } from '../env';

const REST_PREFIX = '/rest/v1';

export class SupabaseRestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SupabaseRestError';
    this.status = status;
  }
}

const ensureConfig = (env: Env) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new SupabaseRestError('Supabase REST configuration is missing', 500);
  }
};

const resolveRestUrl = (env: Env, path: string, searchParams?: Record<string, string>): URL => {
  const url = new URL(`${REST_PREFIX}/${path}`, env.SUPABASE_URL);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
};

const restHeaders = (env: Env, prefer?: string): HeadersInit => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  };
  if (prefer) {
    headers.Prefer = prefer;
  }
  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  const text = await response.text();
  return text as unknown as T;
};

/** Supabase REST（service role）への汎用リクエスト。 */
export const supabaseRequest = async <T>(
  env: Env,
  method: string,
  path: string,
  options: {
    searchParams?: Record<string, string>;
    body?: unknown;
    prefer?: string;
  } = {},
): Promise<T> => {
  ensureConfig(env);
  const url = resolveRestUrl(env, path, options.searchParams);
  const response = await fetch(url, {
    method,
    headers: restHeaders(env, options.prefer),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    throw new SupabaseRestError(
      `Supabase request failed: ${method} ${url.toString()} (${response.status}) ${JSON.stringify(detail)}`,
      response.status,
    );
  }

  return handleResponse<T>(response);
};

/** PostgREST の検索語に使えないよう特殊文字を除去する。 */
export const sanitizePostgrestSearchTerm = (value: string): string =>
  value
    .replace(/[(),{}"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
