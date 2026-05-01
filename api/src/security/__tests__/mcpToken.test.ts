import { describe, expect, it } from 'vitest';
import { generateMcpToken, hashMcpToken, MCP_TOKEN_PREFIX } from '../mcpToken';

describe('mcpToken security helpers', () => {
  it('generates prefixed high-entropy bearer tokens', () => {
    const token = generateMcpToken();

    expect(token).toMatch(new RegExp(`^${MCP_TOKEN_PREFIX}[0-9a-f]{64}$`));
    expect(generateMcpToken()).not.toBe(token);
  });

  it('hashes tokens with a configured pepper', async () => {
    const token = `${MCP_TOKEN_PREFIX}${'a'.repeat(64)}`;

    const hash = await hashMcpToken(token, 'pepper');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    await expect(hashMcpToken(token, 'other-pepper')).resolves.not.toBe(hash);
  });

  it('rejects missing pepper and non-MCP token prefixes', async () => {
    await expect(hashMcpToken(`${MCP_TOKEN_PREFIX}${'a'.repeat(64)}`, undefined)).rejects.toThrow(
      'MCP_TOKEN_HASH_PEPPER is required',
    );
    await expect(hashMcpToken('supabase-jwt', 'pepper')).rejects.toThrow(
      'Invalid MCP token prefix',
    );
  });
});
