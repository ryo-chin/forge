export const MCP_TOKEN_PREFIX = 'forge_mcp_';
const MCP_TOKEN_BYTES = 32;

export class McpTokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpTokenCryptoError';
  }
}

const bytesToHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const textBytes = (value: string): Uint8Array => new TextEncoder().encode(value);

const digestToHex = (digest: ArrayBuffer): string => bytesToHex(new Uint8Array(digest));

const requirePepper = (pepper: string | undefined): string => {
  const value = pepper?.trim();
  if (!value) {
    throw new McpTokenCryptoError('MCP_TOKEN_HASH_PEPPER is required');
  }
  return value;
};

export const generateMcpToken = (): string => {
  const bytes = new Uint8Array(MCP_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return `${MCP_TOKEN_PREFIX}${bytesToHex(bytes)}`;
};

export const hashMcpToken = async (token: string, pepper: string | undefined): Promise<string> => {
  if (!token.startsWith(MCP_TOKEN_PREFIX)) {
    throw new McpTokenCryptoError('Invalid MCP token prefix');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    textBytes(requirePepper(pepper)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textBytes(token));
  return digestToHex(signature);
};
