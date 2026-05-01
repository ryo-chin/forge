import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMcpTokenRecord,
  findMcpTokenRecordByHash,
  listMcpTokenRecords,
  revokeMcpTokenRecord,
  touchMcpTokenRecord,
} from '../mcpTokens';

const env = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  GOOGLE_REDIRECT_URI: '',
  MCP_TOKEN_HASH_PEPPER: 'pepper',
} as const;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('MCP token Supabase repository', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('creates token rows without returning raw token material to the database', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          id: 'token-1',
          user_id: 'user-1',
          name: 'Codex',
          token_hash: 'hash',
          scopes: ['time-tracker:read', 'time-tracker:write'],
          expires_at: '2026-08-01T00:00:00.000Z',
          revoked_at: null,
          last_used_at: null,
          created_at: '2026-05-01T00:00:00.000Z',
          updated_at: '2026-05-01T00:00:00.000Z',
        },
      ]),
    );

    await createMcpTokenRecord(env, {
      userId: 'user-1',
      name: 'Codex',
      tokenHash: 'hash',
      scopes: ['time-tracker:read', 'time-tracker:write'],
      expiresAt: '2026-08-01T00:00:00.000Z',
    });

    const [url, init] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.pathname).toBe('/rest/v1/forge_mcp_tokens');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init.body))).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        name: 'Codex',
        token_hash: 'hash',
        scopes: ['time-tracker:read', 'time-tracker:write'],
      }),
    );
    expect(String(init.body)).not.toContain('forge_mcp_');
  });

  it('lists only tokens owned by the verified user', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await listMcpTokenRecords(env, 'user-1');

    const [url, init] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(String(url));
    expect(init).toMatchObject({ method: 'GET' });
    expect(parsedUrl.searchParams.get('user_id')).toBe('eq.user-1');
    expect(parsedUrl.searchParams.get('order')).toBe('created_at.desc');
  });

  it('looks up token rows by hash only', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await findMcpTokenRecordByHash(env, 'hash');

    const [url, init] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(String(url));
    expect(init).toMatchObject({ method: 'GET' });
    expect(parsedUrl.searchParams.get('token_hash')).toBe('eq.hash');
    expect(parsedUrl.searchParams.toString()).not.toContain('forge_mcp_');
  });

  it('revokes only tokens owned by the verified user', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await revokeMcpTokenRecord(env, 'user-1', 'token-1');

    const [url, init] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(String(url));
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(parsedUrl.searchParams.get('id')).toBe('eq.token-1');
    expect(parsedUrl.searchParams.get('user_id')).toBe('eq.user-1');
    expect(JSON.parse(String(init.body))).toHaveProperty('revoked_at');
  });

  it('updates last_used_at without changing token secrets', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await touchMcpTokenRecord(env, 'token-1');

    const [url, init] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(String(url));
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(parsedUrl.searchParams.get('id')).toBe('eq.token-1');
    expect(JSON.parse(String(init.body))).toHaveProperty('last_used_at');
    expect(String(init.body)).not.toContain('token_hash');
  });
});
